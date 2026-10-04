import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Nothing here calls AWS: the deploy script's decisions are pure functions, and only its
// main() runs commands. Imported lazily so each test fails on its own while the script is missing.
const deploy = () => import('../scripts/deploy-aws.js');
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const SECRETS = { SIGNAL10_USERNAME: 'owner', SIGNAL10_PASSWORD: 'correct horse', ANTHROPIC_API_KEY: 'sk-ant-test-123' };

test('the deployed environment carries the credentials and refuses to deploy without them', async () => {
  const { deployEnvironment } = await deploy();
  const variables = deployEnvironment(SECRETS);
  for (const [name, value] of Object.entries(SECRETS)) assert.equal(variables[name], value);

  assert.throws(() => deployEnvironment({ ...SECRETS, SIGNAL10_USERNAME: '' }), /SIGNAL10_USERNAME/);
  assert.throws(() => deployEnvironment({ ...SECRETS, SIGNAL10_PASSWORD: undefined }), /SIGNAL10_PASSWORD/);

  const withoutKey = deployEnvironment({ ...SECRETS, ANTHROPIC_API_KEY: undefined });
  assert.equal('ANTHROPIC_API_KEY' in withoutKey, false);
});

test('the bundle holds what the server needs and nothing else', async () => {
  const { BUNDLE } = await deploy();
  for (const needed of ['server.js', 'package.json', 'run.sh', 'src', 'public', 'node_modules']) {
    assert.ok(BUNDLE.includes(needed), `${needed} is missing from the bundle`);
  }
  for (const excluded of ['.env', '.git', 'test', 'intents', 'plugins', '.']) {
    assert.equal(BUNDLE.includes(excluded), false, `${excluded} must not be bundled`);
  }
});

test('no secret value appears in any AWS CLI argument', async () => {
  const { deploySteps } = await deploy();
  const paths = { roleArn: 'arn:aws:iam::1:role/signal10-lambda', zipFile: '/tmp/signal10.zip', envFile: '/tmp/env.json' };
  for (const exists of [false, true]) {
    const args = deploySteps({ exists, profile: 'mkendall', region: 'us-east-2', ...paths }).flat();
    for (const value of Object.values(SECRETS)) {
      assert.equal(args.some((arg) => arg.includes(value)), false);
    }
    assert.ok(args.includes('file:///tmp/env.json'), 'the environment is passed as a file reference');
  }
});

test('the first deploy creates the function, later deploys update it, both with the chosen profile', async () => {
  const { deploySteps, profileFrom } = await deploy();
  const options = { profile: 'mkendall', region: 'us-east-2', roleArn: 'arn:role', zipFile: '/tmp/z.zip', envFile: '/tmp/e.json' };

  const first = deploySteps({ ...options, exists: false });
  assert.ok(first.some((step) => step.includes('create-function')));
  assert.equal(first.some((step) => step.includes('update-function-code')), false);

  const later = deploySteps({ ...options, exists: true });
  assert.ok(later.some((step) => step.includes('update-function-code')));
  assert.ok(later.some((step) => step.includes('update-function-configuration')));
  assert.equal(later.some((step) => step.includes('create-function')), false);

  for (const step of [...first, ...later]) {
    assert.equal(step[step.indexOf('--profile') + 1], 'mkendall');
    assert.equal(step[step.indexOf('--region') + 1], 'us-east-2');
  }

  assert.equal(profileFrom({}), 'mkendall');
  assert.equal(profileFrom({ AWS_PROFILE: 'admin' }), 'admin');
});

test('npm run deploy:aws runs the script, and run.sh starts the server', async () => {
  const pkg = JSON.parse(await read('package.json'));
  assert.equal(pkg.scripts['deploy:aws'], 'node scripts/deploy-aws.js');
  assert.match(await read('run.sh'), /^exec node server\.js$/m);
});

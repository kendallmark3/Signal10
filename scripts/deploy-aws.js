// Deploys Signal10 to AWS Lambda behind a Function URL: `npm run deploy:aws`.
// The first run creates the role, the function and the URL; later runs update the function.
// The decisions are pure functions so the tests can check them; only main() runs commands.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const FUNCTION = 'signal10';
export const ROLE = 'signal10-lambda';
// Everything the server needs at run time. Anything not listed, .env included, stays behind.
export const BUNDLE = ['server.js', 'package.json', 'run.sh', 'src', 'public', 'node_modules'];

const PORT = '8080';
// AWS's own Lambda Web Adapter (1.0.1), which lets server.js run unchanged as a web server.
const adapterLayer = (region) => `arn:aws:lambda:${region}:753240598075:layer:LambdaAdapterLayerArm64:28`;
const TRUST = {
  Version: '2012-10-17',
  Statement: [{ Effect: 'Allow', Principal: { Service: 'lambda.amazonaws.com' }, Action: 'sts:AssumeRole' }],
};

export const profileFrom = (env) => env.AWS_PROFILE || 'mkendall';

// The function's environment. Throws rather than deploy a site nobody can sign in to.
export function deployEnvironment(env) {
  for (const name of ['SIGNAL10_USERNAME', 'SIGNAL10_PASSWORD']) {
    if (!env[name]) throw new Error(`${name} is not set. Add it to .env or the environment before deploying.`);
  }
  return {
    SIGNAL10_USERNAME: env.SIGNAL10_USERNAME,
    SIGNAL10_PASSWORD: env.SIGNAL10_PASSWORD,
    ...(env.ANTHROPIC_API_KEY ? { ANTHROPIC_API_KEY: env.ANTHROPIC_API_KEY } : {}),
    PORT,
    AWS_LAMBDA_EXEC_WRAPPER: '/opt/bootstrap',
    AWS_LWA_PORT: PORT,
    // The only route that answers 200 without a session.
    AWS_LWA_READINESS_CHECK_PATH: '/login',
  };
}

// The AWS CLI calls that create or update the function. The environment travels as a file
// reference, so no secret is ever a command-line argument.
export function deploySteps({ exists, profile, region, roleArn, zipFile, envFile }) {
  const aws = (...args) => ['lambda', ...args, '--function-name', FUNCTION, '--profile', profile, '--region', region];
  const settings = [
    '--runtime', 'nodejs22.x',
    '--handler', 'run.sh',
    '--role', roleArn,
    '--layers', adapterLayer(region),
    '--timeout', '120',
    '--memory-size', '512',
    '--environment', `file://${envFile}`,
  ];
  if (!exists) {
    return [
      aws('create-function', '--architectures', 'arm64', '--zip-file', `fileb://${zipFile}`, ...settings),
      aws('wait', 'function-active-v2'),
    ];
  }
  return [
    aws('update-function-code', '--zip-file', `fileb://${zipFile}`),
    aws('wait', 'function-updated-v2'),
    aws('update-function-configuration', ...settings),
    aws('wait', 'function-updated-v2'),
  ];
}

function main() {
  const root = fileURLToPath(new URL('..', import.meta.url));
  try {
    process.loadEnvFile(join(root, '.env'));
  } catch {
    // No .env file: the credentials come from the real environment.
  }
  const variables = deployEnvironment(process.env);
  const profile = profileFrom(process.env);

  const run = (args, options = {}) => execFileSync('aws', [...args, '--output', 'text'], { encoding: 'utf8', ...options }).trim();
  const quiet = { stdio: ['ignore', 'pipe', 'ignore'] };
  const attempt = (args) => {
    try {
      return run(args, quiet);
    } catch {
      return null;
    }
  };
  const scoped = (...args) => [...args, '--profile', profile];

  const region = process.env.AWS_REGION || run(['configure', 'get', 'region', '--profile', profile]);
  const account = run(scoped('sts', 'get-caller-identity', '--query', 'Account'));
  console.log(`Deploying ${FUNCTION} to account ${account} in ${region} as profile ${profile}`);

  const work = mkdtempSync(join(tmpdir(), 'signal10-deploy-'));
  try {
    const zipFile = join(work, 'signal10.zip');
    const envFile = join(work, 'environment.json');
    writeFileSync(envFile, JSON.stringify({ Variables: variables }), { mode: 0o600 });
    execFileSync('zip', ['-qr', zipFile, ...BUNDLE, '-x', '*.DS_Store'], { cwd: root });

    let roleArn = attempt(scoped('iam', 'get-role', '--role-name', ROLE, '--query', 'Role.Arn'));
    if (!roleArn) {
      console.log(`Creating role ${ROLE}`);
      roleArn = run(scoped('iam', 'create-role', '--role-name', ROLE, '--assume-role-policy-document', JSON.stringify(TRUST), '--query', 'Role.Arn'));
      run(scoped('iam', 'attach-role-policy', '--role-name', ROLE, '--policy-arn', 'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole'));
      // A new role is not usable by Lambda for a few seconds after IAM returns it.
      execFileSync('sleep', ['10']);
    }

    const target = ['--function-name', FUNCTION, '--profile', profile, '--region', region];
    const exists = attempt(['lambda', 'get-function', ...target, '--query', 'Configuration.FunctionName']) !== null;
    console.log(exists ? 'Updating the function' : 'Creating the function');
    for (const step of deploySteps({ exists, profile, region, roleArn, zipFile, envFile })) run(step);

    let url = attempt(['lambda', 'get-function-url-config', ...target, '--query', 'FunctionUrl']);
    if (!url) {
      console.log('Creating the public URL');
      url = run(['lambda', 'create-function-url-config', ...target, '--auth-type', 'NONE', '--query', 'FunctionUrl']);
      // A public Function URL needs both permissions. The site's own sign-in is the protection.
      run(['lambda', 'add-permission', ...target, '--statement-id', 'public-url', '--action', 'lambda:InvokeFunctionUrl', '--principal', '*', '--function-url-auth-type', 'NONE']);
      run(['lambda', 'add-permission', ...target, '--statement-id', 'public-url-invoke', '--action', 'lambda:InvokeFunction', '--principal', '*', '--invoked-via-function-url']);
    }
    console.log(`\nSignal10 is live at ${url}`);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (err) {
    console.error(err.stderr?.toString().trim() || err.message);
    process.exit(1);
  }
}

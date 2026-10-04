import test from 'node:test';
import assert from 'node:assert/strict';
import { createAuth } from '../src/auth.js';

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

// A clock the tests can move forward.
function setup(overrides = {}) {
  const clock = { now: 1_800_000_000_000 };
  const auth = createAuth({ username: 'owner', password: 'correct horse', now: () => clock.now, ...overrides });
  return { auth, clock };
}

test('only the right username and password together are accepted', () => {
  const { auth } = setup();

  assert.equal(auth.signIn('owner', 'correct horse').ok, true);
  assert.equal(auth.signIn('owner', 'wrong').ok, false);
  assert.equal(auth.signIn('someone', 'correct horse').ok, false);
  assert.equal(auth.signIn('', '').ok, false);
  assert.equal(auth.signIn(undefined, undefined).ok, false);
  assert.equal(auth.signIn('owner', 'correct horse ').ok, false);
});

test('signing in issues a session that is accepted for seven days', () => {
  const { auth, clock } = setup();
  const { session } = auth.signIn('owner', 'correct horse');

  assert.equal(auth.isSignedIn(session), true);
  clock.now += 7 * DAY - MINUTE;
  assert.equal(auth.isSignedIn(session), true);
  clock.now += 2 * MINUTE;
  assert.equal(auth.isSignedIn(session), false);
});

test('a failed sign-in issues no session', () => {
  const { auth } = setup();

  assert.equal(auth.signIn('owner', 'wrong').session, undefined);
});

test('an altered, malformed or missing session is rejected', () => {
  const { auth } = setup();
  const { session } = auth.signIn('owner', 'correct horse');
  const [expires, signature] = session.split('.');

  assert.equal(auth.isSignedIn(`${Number(expires) + 1}.${signature}`), false, 'expiry pushed out');
  assert.equal(auth.isSignedIn(`${expires}.${signature.slice(0, -1)}x`), false, 'signature changed');
  assert.equal(auth.isSignedIn(`${expires}.`), false);
  assert.equal(auth.isSignedIn('not-a-session'), false);
  assert.equal(auth.isSignedIn(''), false);
  assert.equal(auth.isSignedIn(undefined), false);
});

test('changing the password invalidates sessions issued under the old one', () => {
  const { auth } = setup();
  const { session } = auth.signIn('owner', 'correct horse');
  const { auth: afterChange } = setup({ password: 'new password' });

  assert.equal(afterChange.isSignedIn(session), false);
});

test('the session does not contain the username or the password', () => {
  const { auth } = setup();
  const { session } = auth.signIn('owner', 'correct horse');

  assert.doesNotMatch(session, /owner|correct|horse/);
  assert.doesNotMatch(Buffer.from(session, 'base64').toString(), /owner|correct horse/);
});

test('five failed sign-ins in a row lock sign-in for 60 seconds', () => {
  const { auth, clock } = setup();
  for (let i = 0; i < 5; i++) assert.equal(auth.signIn('owner', 'guess').ok, false);

  const locked = auth.signIn('owner', 'correct horse');
  assert.equal(locked.ok, false);
  assert.equal(locked.locked, true);

  clock.now += 61 * 1000;
  assert.equal(auth.signIn('owner', 'correct horse').ok, true);
});

test('a successful sign-in resets the failure count', () => {
  const { auth } = setup();
  for (let i = 0; i < 4; i++) auth.signIn('owner', 'guess');
  assert.equal(auth.signIn('owner', 'correct horse').ok, true);
  for (let i = 0; i < 4; i++) auth.signIn('owner', 'guess');

  assert.equal(auth.signIn('owner', 'correct horse').ok, true);
});

test('auth cannot be created without both a username and a password', () => {
  assert.throws(() => createAuth({ username: 'owner', password: '' }), /SIGNAL10_PASSWORD/);
  assert.throws(() => createAuth({ username: '', password: 'x' }), /SIGNAL10_USERNAME/);
  assert.throws(() => createAuth({}), /SIGNAL10_USERNAME/);
});

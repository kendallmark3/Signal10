// Single-owner sign-in. One username and password from the server environment; a signed,
// expiring session value for the cookie. No accounts and nothing stored.
import { createHmac, timingSafeEqual } from 'node:crypto';

const SESSION_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_FAILURES = 5;
const LOCK_MS = 60 * 1000;

const digest = (key, value) => createHmac('sha256', key).update(String(value)).digest();
// Compares digests, not the raw strings, so length and content timing reveal nothing.
const same = (a, b) => timingSafeEqual(digest('compare', a), digest('compare', b));

export function createAuth({ username, password, now = Date.now } = {}) {
  if (!username) throw new Error('SIGNAL10_USERNAME is not set. Signal10 will not start without a sign-in username.');
  if (!password) throw new Error('SIGNAL10_PASSWORD is not set. Signal10 will not start without a sign-in password.');

  // Derived from the credentials, so changing either one signs everybody out.
  const signingKey = digest(password, `signal10-session:${username}`);
  const sign = (expires) => digest(signingKey, expires).toString('base64url');

  let failures = 0;
  let lockedUntil = 0;

  return {
    signIn(givenUsername, givenPassword) {
      if (now() < lockedUntil) return { ok: false, locked: true };

      const matches = same(givenUsername ?? '', username) & same(givenPassword ?? '', password);
      if (!matches) {
        failures += 1;
        if (failures >= MAX_FAILURES) {
          failures = 0;
          lockedUntil = now() + LOCK_MS;
        }
        return { ok: false, locked: false };
      }

      failures = 0;
      const expires = now() + SESSION_MS;
      return { ok: true, session: `${expires}.${sign(expires)}`, maxAgeSeconds: SESSION_MS / 1000 };
    },

    isSignedIn(session) {
      const [expires, signature, ...rest] = String(session ?? '').split('.');
      if (!/^\d+$/.test(expires) || !signature || rest.length > 0) return false;
      return same(signature, sign(expires)) && now() < Number(expires);
    },
  };
}

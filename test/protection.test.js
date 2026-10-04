import test from 'node:test';
import assert from 'node:assert/strict';
import { createAuth } from '../src/auth.js';
import * as serverModule from '../server.js';

// Starts the real app on a free local port with test credentials. Nothing here reaches
// YouTube or Anthropic: every request is either refused or asks only for the page.
async function withApp(run) {
  const auth = createAuth({ username: 'owner', password: 'correct horse' });
  const app = serverModule.createApp({ auth });
  await new Promise((resolve) => app.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${app.address().port}`;
  const request = (path, options = {}) => fetch(base + path, { redirect: 'manual', ...options });
  const signIn = (username, password) =>
    request('/login', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ username, password }).toString(),
    });
  try {
    await run({ request, signIn });
  } finally {
    await new Promise((resolve) => app.close(resolve));
  }
}

const cookieFrom = (response) => (response.headers.get('set-cookie') ?? '').split(';')[0];

test('without a session the page redirects to sign-in and the APIs return 401 with no data', async () => {
  await withApp(async ({ request }) => {
    const page = await request('/');
    assert.equal(page.status, 302);
    assert.equal(page.headers.get('location'), '/login');

    for (const path of ['/api/top10?topic=python', '/api/architect?topic=python']) {
      const api = await request(path);
      assert.equal(api.status, 401, path);
      assert.deepEqual(Object.keys(await api.json()), ['error'], path);
    }
  });
});

test('a forged session cookie does not get in', async () => {
  await withApp(async ({ request }) => {
    const page = await request('/', { headers: { cookie: 'signal10_session=9999999999999.forged' } });
    assert.equal(page.status, 302);
  });
});

test('the sign-in page is reachable without a session', async () => {
  await withApp(async ({ request }) => {
    const page = await request('/login');
    assert.equal(page.status, 200);
    const html = await page.text();
    assert.match(html, /<form[^>]*method="post"/i);
    assert.match(html, /type="password"/);
  });
});

test('a correct sign-in sets an HttpOnly cookie and the page then loads', async () => {
  await withApp(async ({ request, signIn }) => {
    const response = await signIn('owner', 'correct horse');
    assert.equal(response.status, 302);
    assert.equal(response.headers.get('location'), '/');
    const setCookie = response.headers.get('set-cookie');
    assert.match(setCookie, /^signal10_session=/);
    assert.match(setCookie, /HttpOnly/i);
    assert.match(setCookie, /SameSite=Lax/i);

    const page = await request('/', { headers: { cookie: cookieFrom(response) } });
    assert.equal(page.status, 200);
    assert.match(await page.text(), /<form id="search">/);
  });
});

test('a wrong sign-in sets no cookie and returns to the sign-in page with an error', async () => {
  await withApp(async ({ request, signIn }) => {
    const response = await signIn('owner', 'wrong');
    assert.equal(response.status, 302);
    assert.equal(response.headers.get('location'), '/login?error=1');
    assert.equal(response.headers.get('set-cookie'), null);

    const page = await request('/login?error=1');
    assert.match(await page.text(), /not recognised|incorrect|did not match/i);
  });
});

test('signing out clears the cookie and the page is protected again', async () => {
  await withApp(async ({ request, signIn }) => {
    const cookie = cookieFrom(await signIn('owner', 'correct horse'));

    const out = await request('/logout', { method: 'POST', headers: { cookie } });
    assert.equal(out.status, 302);
    assert.equal(out.headers.get('location'), '/login');
    assert.match(out.headers.get('set-cookie'), /^signal10_session=;.*Max-Age=0/i);

    const page = await request('/', { headers: { cookie: cookieFrom(out) } });
    assert.equal(page.status, 302);
  });
});

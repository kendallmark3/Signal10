import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createAuth } from '../src/auth.js';
import { createApp } from '../server.js';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url));

async function withApp(run) {
  const auth = createAuth({ username: 'owner', password: 'correct horse' });
  const app = createApp({ auth });
  await new Promise((resolve) => app.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${app.address().port}`;
  const cookie = `signal10_session=${auth.signIn('owner', 'correct horse').session}`;
  try {
    await run((path, signedIn) => fetch(base + path, { redirect: 'manual', headers: signedIn ? { cookie } : {} }));
  } finally {
    await new Promise((resolve) => app.close(resolve));
  }
}

// Canvas size from the VP8X header that cwebp writes for an image with transparency.
function webpSize(file) {
  assert.equal(file.toString('latin1', 12, 16), 'VP8X');
  return { width: file.readUIntLE(24, 3) + 1, height: file.readUIntLE(27, 3) + 1 };
}

const logoTag = (html) => /<img[^>]*class="logo"[^>]*>/.exec(html)?.[0] ?? '';
const css = (html) => /<style>([\s\S]*?)<\/style>/.exec(html)[1];

test('the logo is served to a signed-in visitor as a cacheable WebP, and refused without a session', async () => {
  await withApp(async (request) => {
    const response = await request('/logo.webp', true);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'image/webp');
    assert.match(response.headers.get('cache-control'), /max-age=\d+/);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), await read('public/logo.webp'));

    assert.equal((await request('/logo.webp', false)).status, 302);
  });
});

test('the sign-in screen shows the logo without a session by embedding it', async () => {
  await withApp(async (request) => {
    const html = await (await request('/login', false)).text();
    const tag = logoTag(html);
    assert.match(tag, /src="data:image\/webp;base64,[A-Za-z0-9+/=]+"/);
    assert.match(tag, /alt="Signal10"/);
    assert.equal(html.includes('/logo.webp'), false);
  });
});

test('the main page shows the logo with its real proportions declared', async () => {
  const tag = logoTag((await read('public/index.html')).toString());
  assert.match(tag, /src="\/logo\.webp"/);
  assert.match(tag, /alt="Signal10"/);
  const declared = Number(/width="(\d+)"/.exec(tag)?.[1]) / Number(/height="(\d+)"/.exec(tag)?.[1]);
  const { width, height } = webpSize(await read('public/logo.webp'));
  assert.ok(Math.abs(declared - width / height) < 0.01, `declared ${declared}, actual ${width / height}`);
});

test('on both pages the logo scales with the screen, keeps its proportions, and has a light plate in the dark theme', async () => {
  for (const page of ['public/index.html', 'public/login.html']) {
    const styles = css((await read(page)).toString());
    const rule = /\.logo \{([^}]*)\}/.exec(styles)?.[1] ?? '';
    assert.match(rule, /max-width: 100%/, page);
    assert.match(rule, /height: auto/, page);
    const dark = styles.slice(styles.indexOf('prefers-color-scheme: dark'));
    assert.match(dark, /\.logo \{[^}]*background: #f/, page);
  }
});

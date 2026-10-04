import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createAuth } from '../src/auth.js';
import { createApp } from '../server.js';

// Imported lazily so each test fails on its own while the module is missing.
const recent = () => import('../public/recent.js');

function fakeStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, String(value)) };
}

test('the newest search comes first and a sixth unique search drops the oldest', async () => {
  const { addRecent } = await recent();
  let list = [];
  for (const topic of ['one', 'two', 'three', 'four', 'five']) list = addRecent(list, topic);
  assert.deepEqual(list, ['five', 'four', 'three', 'two', 'one']);
  assert.deepEqual(addRecent(list, 'six'), ['six', 'five', 'four', 'three', 'two']);
});

test('searching a remembered topic again moves it to the front without a duplicate', async () => {
  const { addRecent } = await recent();
  const list = ['AWS AgentCore', 'Learn Python', 'Mapbox development'];
  assert.deepEqual(addRecent(list, 'Mapbox development'), ['Mapbox development', 'AWS AgentCore', 'Learn Python']);
  assert.deepEqual(addRecent(list, '  learn   python '), ['learn python', 'AWS AgentCore', 'Mapbox development']);
});

test('a blank search is not saved', async () => {
  const { addRecent } = await recent();
  assert.deepEqual(addRecent(['one'], ''), ['one']);
  assert.deepEqual(addRecent(['one'], '   '), ['one']);
});

test('the list survives storage, and unusable storage gives an empty list', async () => {
  const { loadRecent, saveRecent, STORAGE_KEY: key } = await recent();
  const storage = fakeStorage();
  saveRecent(storage, ['two', 'one']);
  assert.deepEqual(loadRecent(storage), ['two', 'one']);

  assert.deepEqual(loadRecent(fakeStorage({ [key]: 'not json' })), []);
  assert.deepEqual(loadRecent(fakeStorage({ [key]: '{"a":1}' })), []);
  assert.deepEqual(loadRecent(fakeStorage({ [key]: '["ok", 7, "", "a","b","c","d","e"]' })), ['ok', 'a', 'b', 'c', 'd']);
  const broken = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('full'); } };
  assert.deepEqual(loadRecent(broken), []);
  assert.doesNotThrow(() => saveRecent(broken, ['one']));
  assert.deepEqual(loadRecent(undefined), []);
});

test('the page loads recent.js, served as JavaScript only to a signed-in visitor', async () => {
  const auth = createAuth({ username: 'owner', password: 'correct horse' });
  const app = createApp({ auth });
  await new Promise((resolve) => app.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${app.address().port}/recent.js`;
  try {
    const cookie = `signal10_session=${auth.signIn('owner', 'correct horse').session}`;
    const response = await fetch(url, { headers: { cookie } });
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /^text\/javascript/);
    assert.match(await response.text(), /export function addRecent/);
    assert.equal((await fetch(url, { redirect: 'manual' })).status, 302);
  } finally {
    await new Promise((resolve) => app.close(resolve));
  }
  const page = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  assert.match(page, /from '\/recent\.js'/);
  assert.match(page, /id="recent"[^>]*hidden/);
});

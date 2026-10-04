import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = async (path) => (await readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
const credit = (html) => /<p class="credit">([\s\S]*?)<\/p>/.exec(html)?.[1] ?? '';
const PAGES = ['public/index.html', 'public/login.html'];

test('both pages credit Mark Kendall and link to repogenic.com', async () => {
  for (const page of PAGES) {
    const line = credit(await read(page));
    assert.equal(line.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(), 'Developed by Mark Kendall at repogenic.com', page);
    assert.match(line, /<a href="https:\/\/repogenic\.com"[^>]*>repogenic\.com<\/a>/, page);
  }
});

test('the credit link opens in a new tab with noopener', async () => {
  for (const page of PAGES) {
    const link = /<a [^>]*>/.exec(credit(await read(page)))?.[0] ?? '';
    assert.match(link, /target="_blank"/, page);
    assert.match(link, /rel="noopener"/, page);
  }
});

test('on the main page the credit is outside the footer the page rewrites', async () => {
  const html = await read('public/index.html');
  const footer = /<footer id="footer"[\s\S]*?<\/footer>/.exec(html)[0];
  assert.equal(footer.includes('credit'), false);
  assert.ok(html.indexOf('<p class="credit">') > html.indexOf('</footer>'));
});

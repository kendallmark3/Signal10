import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Imported lazily so each test fails on its own while the module is missing.
const openLibrary = () => import('../src/openlibrary.js');

// Shaped like the search replies Open Library gave on 2026-10-05.
const doc = (overrides = {}) => ({
  key: '/works/OL17192141W',
  title: 'Automate the Boring Stuff with Python',
  subtitle: 'Practical Programming for Total Beginners',
  author_name: ['Al Sweigart'],
  first_publish_year: 2015,
  cover_i: 7363640,
  ebook_access: 'public',
  language: ['chi', 'eng'],
  ...overrides,
});
const borrowable = (n, overrides = {}) => doc({
  key: `/works/OL${n}W`, title: `Python for beginners volume ${n}`, subtitle: undefined, author_name: [`Author ${n}`],
  ebook_access: 'borrowable', language: ['eng'], cover_i: n, ...overrides,
});
const okFetch = (docs, calls = []) => async (url, options) => {
  calls.push({ url: String(url), options });
  return { ok: true, status: 200, json: async () => ({ numFound: docs.length, docs }) };
};

test('one keyless request asks for readable books and only the fields used', async () => {
  const { searchUrl } = await openLibrary();
  const url = new URL(searchUrl('Python for beginners'));
  assert.equal(url.origin + url.pathname, 'https://openlibrary.org/search.json');
  assert.match(url.searchParams.get('q'), /Python for beginners/);
  assert.match(url.searchParams.get('q'), /ebook_access:\[borrowable TO \*\]/);
  assert.deepEqual(url.searchParams.get('fields').split(',').sort(),
    ['author_name', 'cover_i', 'ebook_access', 'first_publish_year', 'key', 'language', 'subtitle', 'title']);
  assert.ok(Number(url.searchParams.get('limit')) <= 30);
  assert.doesNotMatch(url.search, /key=|token|apikey/i);
});

test('only public and borrowable books are kept, public first, each labelled by its availability', async () => {
  const { selectReading } = await openLibrary();
  const picked = selectReading('Python for beginners', [
    borrowable(1),
    doc({ key: '/works/OL2W', title: 'Python for beginners, print only', ebook_access: 'no_ebook' }),
    doc({ key: '/works/OL3W', title: 'Python for beginners, restricted', ebook_access: 'printdisabled' }),
    doc(),
  ]);
  assert.deepEqual(picked.map((b) => b.access), ['public', 'borrowable']);
  assert.equal(picked[0].accessLabel, 'Free to read online');
  assert.equal(picked[1].accessLabel, 'Free to borrow with an Open Library account');
  assert.deepEqual(picked.map((b) => b.number), [1, 2]);
});

test('a book must contain every word of the topic and be available in English', async () => {
  const { selectReading } = await openLibrary();
  const picked = selectReading('machine learning', [
    doc({ key: '/works/OL1W', title: 'The Time Machine', subtitle: undefined, author_name: ['H. G. Wells'] }),
    doc({ key: '/works/OL2W', title: 'Introduction to machine learning', subtitle: undefined, author_name: ['Ethem Alpaydin'], language: ['eng'] }),
    doc({ key: '/works/OL3W', title: 'Machine learning ru men', subtitle: undefined, language: ['chi'] }),
    doc({ key: '/works/OL4W', title: 'Understanding Machines', subtitle: 'From Theory to Learning Algorithms', language: undefined }),
  ]);
  assert.deepEqual(picked.map((b) => b.title), ['Introduction to machine learning', 'Understanding Machines']);
});

test('the same title by the same author appears once, and at most five books are returned', async () => {
  const { selectReading } = await openLibrary();
  const docs = [1, 2, 3, 4, 5, 6, 7].map((n) => borrowable(n));
  docs.splice(1, 0, borrowable(99, { title: 'PYTHON for Beginners  Volume 1', author_name: ['author 1'] }));
  const picked = selectReading('Python for beginners', docs);
  assert.equal(picked.length, 5);
  assert.deepEqual(picked.map((b) => b.url.match(/OL(\d+)W/)[1]), ['1', '2', '3', '4', '5']);
});

test('each book carries real fields only, and a malformed key drops the book', async () => {
  const { selectReading } = await openLibrary();
  const [full, bare, ...rest] = selectReading('Python', [
    doc(),
    doc({ key: '/works/OL5W', title: 'Python', subtitle: undefined, author_name: undefined, first_publish_year: undefined, cover_i: undefined, language: ['eng'] }),
    doc({ key: 'https://evil.example/works/OL6W', title: 'Python tricks' }),
    doc({ key: '/works/OL7W"onclick', title: 'Python tricks two' }),
  ]);
  assert.equal(rest.length, 0);
  assert.deepEqual(full, {
    number: 1,
    title: 'Automate the Boring Stuff with Python',
    subtitle: 'Practical Programming for Total Beginners',
    authors: 'Al Sweigart',
    year: 2015,
    type: 'eBook',
    access: 'public',
    accessLabel: 'Free to read online',
    url: 'https://openlibrary.org/works/OL17192141W',
    cover: 'https://covers.openlibrary.org/b/id/7363640-M.jpg',
  });
  assert.deepEqual([bare.authors, bare.year, bare.cover, bare.subtitle], [null, null, null, null]);
});

test('when Open Library fails the answer is an empty list, and the request identifies Signal10', async () => {
  const { findReading } = await openLibrary();
  const calls = [];
  const found = await findReading('Python for beginners', { fetch: okFetch([doc()], calls) });
  assert.equal(found.length, 1);
  assert.equal(calls.length, 1);
  assert.match(calls[0].options.headers['user-agent'], /Signal10/);

  const failures = [
    async () => { throw new Error('network down'); },
    async () => ({ ok: false, status: 503, json: async () => ({}) }),
    async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('not json'); } }),
    async () => ({ ok: true, status: 200, json: async () => ({ docs: 'nope' }) }),
  ];
  for (const fetch of failures) assert.deepEqual(await findReading('Python', { fetch }), []);
});

test('the page has a Reading section that starts hidden', async () => {
  const page = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  assert.match(page, /<section id="reading"[^>]*hidden/);
});

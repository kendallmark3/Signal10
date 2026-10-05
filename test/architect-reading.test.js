import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRequest, interpret } from '../src/architect.js';

const results = [1, 2, 3].map((rank) => ({
  rank, id: `id${rank}`, title: `Real title ${rank}`, channel: `Channel ${rank}`, publishedText: `${rank} months ago`,
  durationText: `${rank}0:00`, url: `https://www.youtube.com/watch?v=id${rank}`,
}));
const reading = [
  { number: 1, title: 'Automate the Boring Stuff with Python', subtitle: 'Practical Programming for Total Beginners', authors: 'Al Sweigart', year: 2015, type: 'eBook', access: 'public', accessLabel: 'Free to read online', url: 'https://openlibrary.org/works/OL17192141W', cover: 'https://covers.openlibrary.org/b/id/7363640-M.jpg' },
  { number: 2, title: 'Python and algorithmic thinking', subtitle: null, authors: 'Aristides S. Boures', year: 2015, type: 'eBook', access: 'borrowable', accessLabel: 'Free to borrow with an Open Library account', url: 'https://openlibrary.org/works/OL2W', cover: null },
];
const reply = (sequence) => ({
  summary: 'A short orientation.', sequence, prerequisites: [], skip: [], keyConcepts: [], architectureImplications: [], risks: [], nextStep: '',
});

test('with books, the request adds only their number, title, author, year and availability; without books it is unchanged', () => {
  const sent = JSON.stringify(buildRequest('Python for beginners', results, reading));
  for (const book of reading) {
    assert.ok(sent.includes(book.title), book.title);
    assert.ok(sent.includes(book.authors), book.authors);
    assert.ok(sent.includes(book.accessLabel), book.accessLabel);
  }
  assert.ok(sent.includes('2015'));
  assert.doesNotMatch(sent, /openlibrary\.org|covers\./, 'no links or covers');

  assert.deepEqual(buildRequest('Python for beginners', results, []), buildRequest('Python for beginners', results));
  assert.doesNotMatch(JSON.stringify(buildRequest('Python for beginners', results)), /Automate|reading list/i);

  const step = buildRequest('Python for beginners', results, reading).output_config.format.schema.properties.sequence.items;
  assert.deepEqual(step.properties.step.enum, ['watch', 'read']);
});

test('a reading step is resolved from Signal10\'s own list, in order, and the reply cannot introduce a book', () => {
  const view = interpret(reply([
    { step: 'watch', rank: 2, why: 'Start here.' },
    { step: 'read', rank: 1, why: 'Then work through the book.', title: 'Injected title', url: 'https://evil.example' },
    { step: 'read', rank: 9, why: 'No such book.' },
    { step: 'read', rank: 1, why: 'Repeated.' },
    { step: 'watch', rank: 1, why: 'Finish with this.' },
    { step: 'read', rank: 2, why: 'Borrow this for depth.' },
  ]), results, reading);

  assert.deepEqual(view.sequence.map((s) => (s.video ? `watch ${s.video.id}` : `read ${s.reading.number}`)),
    ['watch id2', 'read 1', 'watch id1', 'read 2']);
  assert.deepEqual(view.sequence[1], {
    reading: { number: 1, title: reading[0].title, authors: 'Al Sweigart', year: 2015, access: 'public', accessLabel: 'Free to read online', url: reading[0].url },
    why: 'Then work through the book.',
  });
  assert.doesNotMatch(JSON.stringify(view), /Injected|evil\.example/);

  const videosOnly = interpret(reply([{ step: 'read', rank: 1, why: 'A book.' }, { rank: 3, why: 'A video.' }]), results);
  assert.deepEqual(videosOnly.sequence.map((s) => s.video?.id), ['id3']);
});

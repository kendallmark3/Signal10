import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as youtube from '../src/youtube.js';

// The shapes YouTube's search reply used on 2026-10-04, cut down to the parts that matter.
const reply = (renderer) => ({
  contents: { twoColumnSearchResultsRenderer: { primaryContents: { sectionListRenderer: { contents: [
    { itemSectionRenderer: { contents: [renderer, { videoRenderer: { videoId: 'abc' } }] } },
  ] } } } },
});
const SHOWING = { showingResultsForRenderer: {
  showingResultsFor: { runs: [{ text: 'Showing results for' }] },
  correctedQuery: { runs: [{ text: 'visual ' }, { text: 'merchandising', italics: true }, { text: ' manager' }] },
  originalQuery: { simpleText: 'visual merchandizing manager' },
} };
const DID_YOU_MEAN = { didYouMeanRenderer: {
  didYouMean: { runs: [{ text: 'Did you mean: ' }] },
  correctedQuery: { runs: [{ text: 'kubernetes', italics: true }, { text: ' tutorial' }] },
} };

test('a correction is read from both forms of YouTube reply, and none from a reply without one', () => {
  assert.equal(youtube.correctionFrom(reply(SHOWING)), 'visual merchandising manager');
  assert.equal(youtube.correctionFrom(reply(DID_YOU_MEAN)), 'kubernetes tutorial');
  assert.equal(youtube.correctionFrom(reply({ videoRenderer: { videoId: 'xyz' } })), null);
  assert.equal(youtube.correctionFrom(reply({ didYouMeanRenderer: {} })), null);
});

test('no suggestion is made when the correction is what the user typed', () => {
  assert.equal(youtube.suggestionFor('visual merchandizing manager', ['visual merchandising manager']), 'visual merchandising manager');
  assert.equal(youtube.suggestionFor('AWS  agentcore', ['aws AgentCore']), null);
  assert.equal(youtube.suggestionFor('AWS AgentCore', [null, undefined]), null);
  assert.equal(youtube.suggestionFor('pyhton', [null, 'python', 'pythons']), 'python');
});

test('the page has a "Did you mean" line that starts hidden', async () => {
  const page = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  assert.match(page, /<p id="suggestion"[^>]*hidden/);
  assert.match(page, /Did you mean: /);
});

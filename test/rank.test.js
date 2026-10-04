import test from 'node:test';
import assert from 'node:assert/strict';
import { rank, scoreCandidates, topicTokens } from '../src/rank.js';
import { parseAgeDays, parseDurationSeconds, parseViews } from '../src/youtube.js';

let nextId = 0;
const video = (overrides = {}) => ({
  id: `vid${nextId++}`,
  title: 'Learn Python - Full Course',
  channel: `Channel ${nextId}`,
  verified: false,
  publishedText: '1 year ago',
  ageDays: 365,
  durationText: '30:00',
  durationSeconds: 1800,
  views: 10000,
  snippet: '',
  searchPosition: 0.5,
  url: '',
  thumbnail: '',
  ...overrides,
});

test('parses the text YouTube returns', () => {
  assert.equal(parseViews('22,606 views'), 22606);
  assert.equal(parseViews('1.2M views'), 1200000);
  assert.equal(parseViews('No views'), null);
  assert.equal(parseDurationSeconds('1:08:21'), 4101);
  assert.equal(parseDurationSeconds('LIVE'), null);
  assert.equal(parseAgeDays('Streamed 2 weeks ago'), 14);
  assert.equal(parseAgeDays(undefined), null);
});

test('topic tokens drop filler words but never end up empty', () => {
  assert.deepEqual(topicTokens('Learn Python'), ['python']);
  assert.deepEqual(topicTokens('how to learn'), ['how', 'to', 'learn']);
});

test('a newer video with strong momentum outranks an old video with more lifetime views', () => {
  const old = video({ id: 'old', title: 'Python for everybody', views: 5_000_000, ageDays: 3650, publishedText: '10 years ago' });
  const rising = video({ id: 'rising', title: 'Modern Python crash course', views: 200_000, ageDays: 30, publishedText: '1 month ago' });
  const results = rank('Learn Python', [old, rising]);
  assert.deepEqual(results.map((r) => r.id), ['rising', 'old']);
  assert.equal(results[0].rankByViews, 2);
});

test('off-topic videos are excluded however popular they are', () => {
  const results = rank('AWS AgentCore', [
    video({ id: 'on', title: 'AWS AgentCore tutorial', views: 500 }),
    video({ id: 'off', title: 'Funniest cat compilation', views: 90_000_000 }),
  ]);
  assert.deepEqual(results.map((r) => r.id), ['on']);
});

test('shorts and videos with no duration are excluded', () => {
  const scored = scoreCandidates('Python', [
    video({ id: 'short', durationSeconds: 45 }),
    video({ id: 'live', durationSeconds: null }),
    video({ id: 'ok' }),
  ]);
  assert.deepEqual(scored.map((c) => c.id), ['ok']);
});

test('near-duplicate titles collapse to one result', () => {
  const results = rank('Python', [
    video({ id: 'a', title: 'Python Tutorial for Beginners 2026' }),
    video({ id: 'b', title: 'Python Tutorial for Beginners (2026)' }),
    video({ id: 'c', title: 'Python decorators explained in depth' }),
  ]);
  assert.equal(results.length, 2);
});

test('one channel cannot take more than two places', () => {
  const titles = ['Python basics', 'Python functions deep dive', 'Python classes walkthrough', 'Python async explained'];
  const results = rank('Python', titles.map((title) => video({ title, channel: 'Same Channel' })));
  assert.equal(results.length, 2);
});

test('returns at most the requested number, each with a rank and a reason', () => {
  const pool = Array.from({ length: 25 }, (_, i) => video({ title: `Python lesson ${i} topic${i} unique${i}` }));
  const results = rank('Python', pool);
  assert.equal(results.length, 10);
  results.forEach((r, i) => {
    assert.equal(r.rank, i + 1);
    assert.ok(r.reason.length > 10);
    assert.ok(r.headline);
    assert.ok(r.score >= 0 && r.score <= 100);
  });
});

test('a video with no view count still ranks, without invented numbers', () => {
  const [result] = rank('Python', [video({ views: null })]);
  assert.equal(result.views, null);
  assert.equal(result.viewsPerDay, null);
  assert.doesNotMatch(result.reason, /views a day/);
});

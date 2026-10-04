import test from 'node:test';
import assert from 'node:assert/strict';
import { rank } from '../src/rank.js';

const TOPIC = 'Claude Certified Architect Foundations';

let nextId = 0;
const video = (title, overrides = {}) => ({
  id: `vid${nextId++}`,
  title,
  channel: `Channel ${nextId}`,
  verified: false,
  publishedText: '1 month ago',
  ageDays: 30,
  durationText: '30:00',
  durationSeconds: 1800,
  views: 1000,
  snippet: '',
  searchPosition: 0.5,
  url: '',
  thumbnail: '',
  ...overrides,
});

// A sibling certification: shares three of four topic words and beats everything on momentum.
const sibling = (title) => video(title, { views: 5_000_000, ageDays: 10, verified: true, searchPosition: 0 });

const fullMatches = (count) =>
  Array.from({ length: count }, (_, i) => video(`Claude Certified Architect Foundations lesson ${i} part${i} unit${i}`));

test('a full match ranks above a partial match with a higher score', () => {
  const results = rank(TOPIC, [
    sibling('Claude Certified Developer Foundations Certification Course'),
    video('Claude Certified Architect Foundations exam walkthrough'),
  ]);

  assert.deepEqual(results.map((r) => r.title), [
    'Claude Certified Architect Foundations exam walkthrough',
    'Claude Certified Developer Foundations Certification Course',
  ]);
  assert.ok(results[1].score > results[0].score, 'the sibling should still score higher on the signals');
});

test('with ten or more full matches, no partial match reaches the Top 10', () => {
  const results = rank(TOPIC, [
    sibling('Claude Certified Developer Foundations Certification Course'),
    sibling('Claude Certified Associate Foundations Exam Prep'),
    ...fullMatches(12),
  ]);

  assert.equal(results.length, 10);
  results.forEach((r) => assert.deepEqual(r.missingWords, []));
});

test('partial matches fill the remaining places after every full match', () => {
  const results = rank(TOPIC, [
    sibling('Claude Certified Developer Foundations Certification Course'),
    ...fullMatches(3),
    video('Claude Certified Architect study guide'),
  ]);

  assert.deepEqual(results.map((r) => r.missingWords.length > 0), [false, false, false, true, true]);
  assert.deepEqual(results.map((r) => r.rank), [1, 2, 3, 4, 5]);
  assert.ok(results[3].score >= results[4].score, 'partial matches stay in score order');
});

test('a partial match is labelled and its reason names the missing words as typed', () => {
  const [, partial] = rank(TOPIC, [
    video('Claude Certified Architect Foundations exam walkthrough'),
    video('Claude Certified Developer course'),
  ]);

  assert.deepEqual(partial.missingWords, ['Architect', 'Foundations']);
  assert.equal(partial.headline, 'Partial match');
  assert.match(partial.reason, /does not mention “Architect” or “Foundations”/);
});

test('a full match has no partial-match label and no missing words', () => {
  const [full] = rank(TOPIC, [video('Claude Certified Architect Foundations exam walkthrough')]);

  assert.deepEqual(full.missingWords, []);
  assert.notEqual(full.headline, 'Partial match');
  assert.doesNotMatch(full.reason, /does not mention/);
});

test('the channel name counts toward a full match', () => {
  const [result] = rank('AWS AgentCore', [
    video('Deploy Production-Ready Agents with AgentCore Runtime', { channel: 'AWS Developers' }),
  ]);

  assert.deepEqual(result.missingWords, []);
});

test('single-word topics are ordered by score alone, as before', () => {
  const results = rank('Python', [
    video('Python decorators explained', { views: 100 }),
    video('Python generators walkthrough', { views: 900_000, ageDays: 10 }),
  ]);

  assert.deepEqual(results.map((r) => r.title), ['Python generators walkthrough', 'Python decorators explained']);
  results.forEach((r) => assert.deepEqual(r.missingWords, []));
});

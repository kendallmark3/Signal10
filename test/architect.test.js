import test from 'node:test';
import assert from 'node:assert/strict';
import * as architect from '../src/architect.js';

const { buildRequest, interpret, architectView } = architect;

const results = [1, 2, 3, 4].map((rank) => ({
  rank,
  id: `id${rank}`,
  title: `Real title ${rank}`,
  channel: `Channel ${rank}`,
  verified: true,
  publishedText: `${rank} months ago`,
  publishedDate: '2026-06-01',
  durationText: `${rank}0:00`,
  durationSeconds: rank * 600,
  views: rank * 1000,
  viewsPerDay: 12,
  url: `https://www.youtube.com/watch?v=id${rank}`,
  thumbnail: `https://i.ytimg.com/vi/id${rank}/mqdefault.jpg`,
  score: 90 - rank,
  signals: { relevance: 1, momentum: 1, depth: 1, recency: 1, authority: 1 },
  missingWords: [],
  headline: 'Fresh',
  reason: 'A reason.',
}));

const reply = (overrides = {}) => ({
  summary: 'A short orientation.',
  sequence: [
    { rank: 2, why: 'Start with the overview.' },
    { rank: 1, why: 'Then the deep dive.' },
  ],
  prerequisites: ['Basic AWS IAM'],
  skip: [{ rank: 3, why: 'Repeats video 2.' }],
  keyConcepts: ['Runtime', 'Gateway'],
  architectureImplications: ['Adds a managed control plane.'],
  risks: ['Vendor lock-in.'],
  nextStep: 'Deploy a hello-world agent.',
  ...overrides,
});

// Stands in for the Anthropic SDK client: records calls and returns a canned response.
function fakeClient(respond) {
  const calls = [];
  return {
    calls,
    beta: {
      messages: {
        create: async (params) => {
          calls.push(params);
          return respond(params);
        },
      },
    },
  };
}

const textResponse = (payload) => ({
  stop_reason: 'end_turn',
  content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: JSON.stringify(payload) }],
});

const rejectsWith = (code) => (err) => {
  assert.equal(err.code, code);
  assert.ok(typeof err.message === 'string' && err.message.length > 10, 'needs a message for the user');
  return true;
};

test('the request carries the topic and only minimal metadata for each result', () => {
  const sent = JSON.stringify(buildRequest('AWS AgentCore', results));

  assert.match(sent, /AWS AgentCore/);
  for (const r of results) {
    assert.ok(sent.includes(r.title), `title of rank ${r.rank}`);
    assert.ok(sent.includes(r.channel), `channel of rank ${r.rank}`);
    assert.ok(sent.includes(r.durationText), `duration of rank ${r.rank}`);
    assert.ok(sent.includes(r.publishedText), `published text of rank ${r.rank}`);
    assert.ok(!sent.includes(r.id), 'no video ids');
  }
  assert.doesNotMatch(sent, /youtube\.com|ytimg\.com/, 'no URLs or thumbnails');
  assert.doesNotMatch(sent, /viewsPerDay|signals|"score"|"views"/, 'no scores or view counts');
});

test('a valid reply becomes a full Architect View', () => {
  const view = interpret(reply(), results);

  assert.equal(view.summary, 'A short orientation.');
  assert.deepEqual(view.sequence.map((s) => [s.video.rank, s.why]), [
    [2, 'Start with the overview.'],
    [1, 'Then the deep dive.'],
  ]);
  assert.deepEqual(view.prerequisites, ['Basic AWS IAM']);
  assert.deepEqual(view.skip.map((s) => [s.video.rank, s.why]), [[3, 'Repeats video 2.']]);
  assert.deepEqual(view.keyConcepts, ['Runtime', 'Gateway']);
  assert.deepEqual(view.architectureImplications, ['Adds a managed control plane.']);
  assert.deepEqual(view.risks, ['Vendor lock-in.']);
  assert.equal(view.nextStep, 'Deploy a hello-world agent.');
});

test('videos are resolved from Signal10 results, never from the reply', () => {
  const view = interpret(
    reply({ sequence: [{ rank: 2, why: 'x', title: 'Invented title', url: 'https://evil.example', id: 'fake' }] }),
    results,
  );

  assert.deepEqual(view.sequence[0].video, {
    rank: 2,
    id: 'id2',
    title: 'Real title 2',
    channel: 'Channel 2',
    durationText: '20:00',
    url: 'https://www.youtube.com/watch?v=id2',
  });
});

test('references to ranks that are not in the results are dropped', () => {
  const view = interpret(
    reply({
      sequence: [{ rank: 99, why: 'No such video.' }, { rank: 1, why: 'Real.' }],
      skip: [{ rank: 0, why: 'No such video.' }, { rank: 3, why: 'Real.' }],
    }),
    results,
  );

  assert.deepEqual(view.sequence.map((s) => s.video.rank), [1]);
  assert.deepEqual(view.skip.map((s) => s.video.rank), [3]);
});

test('a video is listed once, and the sequence wins over the skip list', () => {
  const view = interpret(
    reply({
      sequence: [{ rank: 1, why: 'First.' }, { rank: 1, why: 'Again.' }, { rank: 2, why: 'Second.' }],
      skip: [{ rank: 2, why: 'Also skipped?' }, { rank: 3, why: 'Skip.' }, { rank: 3, why: 'Skip again.' }],
    }),
    results,
  );

  assert.deepEqual(view.sequence.map((s) => [s.video.rank, s.why]), [[1, 'First.'], [2, 'Second.']]);
  assert.deepEqual(view.skip.map((s) => s.video.rank), [3]);
});

test('text lists are trimmed, blanks removed, and capped at six items', () => {
  const view = interpret(
    reply({
      prerequisites: ['  HTTP basics  ', '', '   '],
      keyConcepts: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'],
      summary: '  Padded.  ',
    }),
    results,
  );

  assert.deepEqual(view.prerequisites, ['HTTP basics']);
  assert.deepEqual(view.keyConcepts, ['a', 'b', 'c', 'd', 'e', 'f']);
  assert.equal(view.summary, 'Padded.');
});

test('a reply with no usable learning sequence is a failure', () => {
  assert.throws(() => interpret(reply({ sequence: [{ rank: 42, why: 'Nope.' }] }), results), rejectsWith('failed'));
  assert.throws(() => interpret({ nonsense: true }, results), rejectsWith('failed'));
});

test('with no API key configured the model is never called', async () => {
  await assert.rejects(architectView('AWS AgentCore', results, { client: null }), rejectsWith('not_configured'));
});

test('a refusal, an API error and an unreadable reply each give a user-facing error', async () => {
  const refused = fakeClient(() => ({ stop_reason: 'refusal', content: [] }));
  await assert.rejects(architectView('topic', results, { client: refused }), rejectsWith('refused'));

  const broken = fakeClient(() => { throw new Error('connect ECONNREFUSED sk-ant-secret'); });
  await assert.rejects(architectView('topic', results, { client: broken }), (err) => {
    rejectsWith('failed')(err);
    assert.doesNotMatch(err.message, /ECONNREFUSED|sk-ant/, 'raw error details stay out of the user message');
    return true;
  });

  const garbled = fakeClient(() => ({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'not json' }] }));
  await assert.rejects(architectView('topic', results, { client: garbled }), rejectsWith('failed'));

  const cutOff = fakeClient(() => ({ stop_reason: 'max_tokens', content: [{ type: 'text', text: '{"summary":' }] }));
  await assert.rejects(architectView('topic', results, { client: cutOff }), rejectsWith('failed'));
});

test('a successful run calls the model once and returns the interpreted view', async () => {
  const client = fakeClient(() => textResponse(reply()));

  const view = await architectView('AWS AgentCore', results, { client });

  assert.equal(client.calls.length, 1);
  assert.deepEqual(client.calls[0], buildRequest('AWS AgentCore', results));
  assert.deepEqual(view.sequence.map((s) => s.video.id), ['id2', 'id1']);
});

test('with no results there is nothing to reason about and the model is not called', async () => {
  const client = fakeClient(() => textResponse(reply()));

  await assert.rejects(architectView('topic', [], { client }), rejectsWith('failed'));
  assert.equal(client.calls.length, 0);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLearningPath } from '../src/learning-path.js';

test('orders title-indicated stages differently from the Top 10 ranking', () => {
  const ranked = [
    { rank: 1, title: 'Advanced AWS AgentCore' },
    { rank: 2, title: 'AWS AgentCore for Beginners' },
    { rank: 3, title: 'Build an AWS AgentCore app' },
    { rank: 4, title: 'AWS AgentCore key concepts' },
  ];

  const path = buildLearningPath(ranked);

  assert.deepEqual(path.map((video) => video.rank), [2, 4, 1, 3]);
  assert.deepEqual(path.map((video) => video.stage), [
    'Foundation / overview',
    'Core learning',
    'Deeper learning',
    'Practical / application',
  ]);
  path.forEach((video, index) => {
    assert.equal(video.step, index + 1);
    assert.ok(video.pathReason.length > 10);
  });
});

test('uses cautious title-based reasoning for unclassified videos without mutating input', () => {
  const ranked = [{ rank: 1, title: 'AWS AgentCore key concepts' }];
  const original = structuredClone(ranked);

  const [video] = buildLearningPath(ranked);

  assert.deepEqual(ranked, original);
  assert.equal(video.stage, 'Core learning');
  assert.match(video.pathReason, /title does not clearly signal/);
});

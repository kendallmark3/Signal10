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

test('recognizes exam-prep wording: orientation first, courses in the middle, practice last', () => {
  const ranked = [
    { rank: 1, title: 'Claude Certified Architect - Foundations – Prepare for and pass the exam!' },
    { rank: 2, title: 'Claude Certified Architect Foundations: 60 Practice Questions to Help You Prep' },
    { rank: 3, title: 'How to Pass the Claude Certified Architect – Foundations (CCA-F) Exam' },
    { rank: 4, title: 'Practice Q&A | Anthropic Claude Certified Architect – Foundations' },
    { rank: 5, title: 'Claude Certified Architect (CCA-F): Study Guide to Pass First Try' },
    { rank: 6, title: 'CCAO-F Full Claude Certified Associate Foundations Exam Prep in 1 Hour' },
    { rank: 7, title: 'Claude Certified Architect Exam: Everything You Need to Know Before You Book' },
  ];

  const path = buildLearningPath(ranked);

  assert.deepEqual(path.map((video) => [video.rank, video.stage]), [
    [3, 'Foundation / overview'],
    [5, 'Foundation / overview'],
    [7, 'Foundation / overview'],
    [1, 'Core learning'],
    [2, 'Practical / application'],
    [4, 'Practical / application'],
    [6, 'Practical / application'],
  ]);
});

test('when no title carries a stage cue, shorter videos come before longer ones', () => {
  const ranked = [
    { rank: 1, title: 'AWS AgentCore complete course', durationSeconds: 12 * 3600 },
    { rank: 2, title: 'AWS AgentCore key concepts', durationSeconds: 15 * 60 },
    { rank: 3, title: 'AWS AgentCore certification course', durationSeconds: 7 * 3600 },
  ];

  const path = buildLearningPath(ranked);

  assert.deepEqual(path.map((video) => video.rank), [2, 3, 1]);
  path.forEach((video) => {
    assert.equal(video.stage, 'Core learning');
    assert.match(video.pathReason, /shorter videos come first/);
  });
});

test('videos with a stage cue keep their Top 10 order within the stage, whatever their length', () => {
  const ranked = [
    { rank: 1, title: 'Python for Beginners full course', durationSeconds: 13 * 3600 },
    { rank: 2, title: 'Python basics in 10 minutes', durationSeconds: 600 },
  ];

  assert.deepEqual(buildLearningPath(ranked).map((video) => video.rank), [1, 2]);
});

test('the reason quotes the title wording that placed the video', () => {
  const [intro, deep, practical] = buildLearningPath([
    { rank: 1, title: 'AWS AgentCore for Beginners' },
    { rank: 2, title: 'AWS AgentCore Deep Dive' },
    { rank: 3, title: 'AWS AgentCore hands-on Workshop' },
  ]);

  assert.match(intro.pathReason, /“Beginners”/);
  assert.match(deep.pathReason, /“Deep Dive”/);
  assert.match(practical.pathReason, /“hands-on”/);
});

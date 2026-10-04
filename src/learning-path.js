const STAGES = [
  { name: 'Foundation / overview', order: 0 },
  { name: 'Core learning', order: 1 },
  { name: 'Deeper learning', order: 2 },
  { name: 'Practical / application', order: 3 },
];

const FOUNDATION = /\b(beginners?|basics?|fundamentals?|introduction|intro|overview|getting started|start here|first steps|from scratch|everything you need to know|how to pass|study guide)\b/i;
const DEEPER = /\b(advanced|deep dive|in depth|internals|under the hood|masterclass|optimization|optimisation|scaling)\b/i;
const PRACTICAL = /\b(tutorial|hands[- ]on|build|building|project|lab|walkthrough|workshop|demo|implementation|code along|coding|practice|q&a|exam prep|mock exam|quiz)\b/i;

const CORE = 1;
// Checked in this order, so "Beginners Guide [Full Tutorial]" is an introduction, not a build.
const CUES = [[0, FOUNDATION], [2, DEEPER], [3, PRACTICAL]];

function classify(title = '') {
  for (const [stageIndex, pattern] of CUES) {
    const match = pattern.exec(title);
    if (match) return { stageIndex, cue: match[0] };
  }
  return { stageIndex: CORE, cue: null };
}

const REASONS = [
  (cue) => `The title says “${cue}”, which signals introductory material, so start here before core or specialized topics.`,
  () => 'The title does not clearly signal a level or hands-on focus, so it stays in the core learning stage, where shorter videos come first.',
  (cue) => `The title says “${cue}”, which signals advanced or deep-dive material, so it follows the core learning stage.`,
  (cue) => `The title says “${cue}”, which signals practice or a hands-on build, making it a place to apply the concepts.`,
];

// Titles with a cue keep their Top 10 order. Titles without one give no ordering clue, so
// length stands in: a short watch before a long course.
function byLength(a, b) {
  if (a.stageOrder !== CORE || a.durationSeconds == null || b.durationSeconds == null) return 0;
  return a.durationSeconds - b.durationSeconds;
}

export function buildLearningPath(videos) {
  return videos
    .map((video, index) => {
      const { stageIndex, cue } = classify(video.title);
      return {
        ...video,
        step: index + 1,
        stage: STAGES[stageIndex].name,
        pathReason: REASONS[stageIndex](cue),
        stageOrder: STAGES[stageIndex].order,
        originalOrder: index,
      };
    })
    .sort((a, b) => a.stageOrder - b.stageOrder || byLength(a, b) || a.originalOrder - b.originalOrder)
    .map(({ stageOrder, originalOrder, ...video }, index) => ({ ...video, step: index + 1 }));
}

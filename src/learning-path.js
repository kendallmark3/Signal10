const STAGES = [
  { name: 'Foundation / overview', order: 0 },
  { name: 'Core learning', order: 1 },
  { name: 'Deeper learning', order: 2 },
  { name: 'Practical / application', order: 3 },
];

const FOUNDATION = /\b(beginner|beginners|basics|basic|fundamentals?|introduction|intro|overview|getting started|start here|first steps|from scratch)\b/i;
const DEEPER = /\b(advanced|deep dive|in depth|internals|under the hood|masterclass|optimization|optimisation|scaling)\b/i;
const PRACTICAL = /\b(tutorial|hands[- ]on|build|building|project|lab|walkthrough|workshop|demo|implementation|code along|coding)\b/i;

function classify(title = '') {
  if (FOUNDATION.test(title)) return 0;
  if (DEEPER.test(title)) return 2;
  if (PRACTICAL.test(title)) return 3;
  return 1;
}

const REASONS = [
  'The title signals introductory material, so start here before core or specialized topics.',
  'The title does not clearly signal a level or hands-on focus, so it stays in the core learning stage.',
  'The title signals advanced or deep-dive material, so it follows the core learning stage.',
  'The title signals a tutorial, build, or demonstration, making it a place to apply the concepts.',
];

export function buildLearningPath(videos) {
  return videos
    .map((video, index) => {
      const stageIndex = classify(video.title);
      return {
        ...video,
        step: index + 1,
        stage: STAGES[stageIndex].name,
        pathReason: REASONS[stageIndex],
        stageOrder: STAGES[stageIndex].order,
        originalOrder: index,
      };
    })
    .sort((a, b) => a.stageOrder - b.stageOrder || a.originalOrder - b.originalOrder)
    .map(({ stageOrder, originalOrder, ...video }, index) => ({ ...video, step: index + 1 }));
}

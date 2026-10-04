# AI TDD: red commit, then green

This is the way features are built in this repository, written so it can be lifted into any other project. It is a form of test-driven development designed for work done with an AI coding agent: the agent writes the tests from a written intent, commits them while they fail, and only then writes the code.

The failing-test commit is the point. With an AI doing the typing, "the tests came first" is otherwise a claim nobody can check. Here the git history shows it.

## The loop

```text
intent → failing tests → RED commit → implementation → live check → GREEN commit → report
```

1. **Branch.** Create `feature/<name>` from the main branch.
2. **Write the intent.** One short file, `intents/<name>.md`, with the sections listed under [The intent file](#the-intent-file). The numbered success criteria are what the tests will be written from.
3. **Write one failing test per criterion.** Run the suite. Every new test must fail, and fail for the right reason (the behaviour is missing, not a typo or a broken import).
4. **Red commit.** Commit the intent and the failing tests alone. The subject starts with `Red:`. No implementation is in this commit.
5. **Implement.** Change the code until the whole suite passes. Do not touch the red tests to get there.
6. **Live check.** Run the real-world evidence the intent names: real searches, real requests, the real page. Tests passing is not the finish line.
7. **Green commit.** Commit the implementation, with what the live check showed in the message. The subject starts with `Green:`.
8. **Report.** Say what the live check revealed that the criteria did not anticipate. If the criteria were wrong, that is the next loop, not a quiet fix.

## Rules

- No implementation before the red commit exists.
- A red test is only edited if the test itself was wrong. Say so in the commit message.
- If the live check shows a criterion was wrong, revise the criterion in the intent file with a dated note, write a new failing test, and go round the loop again.
- The AI does not widen the feature. Anything outside the intent's stop condition is a separate feature with its own intent.
- A quick look at real data before writing the criteria is allowed and encouraged. It is exploration, and none of that code is kept.

## The intent file

Keep it to one page.

| Section | What goes in it |
| --- | --- |
| Intent | The problem in plain words, with a real example of it going wrong |
| Inputs | What the feature has to work with |
| Outputs | What the user sees or gets that they did not before |
| Success criteria | Numbered, each one testable. One test per criterion |
| Constraints | What must not change: dependencies, existing behaviour, boundaries |
| Evidence required | The tests, plus the live checks that must be run by hand |
| Stop condition | Where the feature ends, and what is explicitly a later feature |

[intents/stricter-topic-match.md](intents/stricter-topic-match.md) is a complete example.

## Starting a feature with an AI agent

Give the agent the feature in a sentence and tell it which loop to follow. This prompt works as written in a repository that contains this file:

```text
New feature: <one sentence describing the problem>.

Follow TDD.md. Create the feature branch, write the intent file with
numbered success criteria, then write one failing test per criterion.
Run the suite, show me the failures, and make the Red commit.
Then implement, run the live checks the intent names, make the Green
commit, and tell me anything the live check showed that the criteria
missed. Do not push or merge.
```

If you want to approve the tests before any code is written, add: `Stop after the Red commit and wait for me.`

## Using this on another project

Copy this file in, then settle four things before the first feature:

1. **The test command.** One command that runs every test and one that runs a single test. Here they are `npm test` and `node --test --test-name-pattern="<name>"`.
2. **Where intents live.** Here, `intents/`.
3. **What a live check is.** The thing you do to see the feature working for real. Here it is running the example searches against the live server.
4. **Where the rule is written for the agent.** Put a short pointer to this file in the project's agent instructions (`CLAUDE.md`, `AGENTS.md`, or equivalent) so every session follows it without being told.

Logic that is pure (data in, data out, no network, no clock) is where this loop works best. Keep as much of the feature as possible in that kind of code so the tests need no mocks.

## Worked example from this repository

The stricter topic match feature went round the loop twice. All four commits are on `main`.

| Commit | What it holds |
| --- | --- |
| `ea59d9f` Red | The intent and seven failing tests, one per criterion |
| `45292d9` Green | Full topic matches rank ahead of partial ones. Live check: the two target searches were fixed, but "Mapbox development" got worse, because weak videos containing the generic word "development" jumped ahead of stronger ones |
| `96d7f9a` Red | Criteria 1 to 3 revised with a dated note; three failing tests for the softened rule |
| `3dd7ec9` Green | Full matches get a 15-point head start instead of absolute priority. Live check recorded in the commit message |

The first green commit passed every test and was still wrong. The tests encoded the rule as it was written; only the live check showed the rule itself needed changing. That is the normal shape of this loop, not a failure of it.

## What this is not

Be honest about the gaps when describing this approach to others.

- **It is batch, not one test at a time.** All the tests for a feature are written up front from the criteria. Classic TDD writes one small test, passes it, and repeats. This is closer to acceptance-test-driven development.
- **There is no fixed refactor step.** The loop is red then green. Refactor when a change starts to feel awkward, under the protection of the existing tests.
- **The same agent writes the criteria, the tests and the code.** The tests catch only what the intent anticipated. The live check and a human reading the red commit are the guards against that.
- **Nothing enforces it.** The loop is a written convention. A person or another tool can commit code with no red commit and nothing will stop them.
- **The live check is manual.** Real-world results are checked by hand each time and are not part of the test suite.

## Where Signal10 stands

- Ranking and learning-path logic are covered by tests; the page and the server are not.
- V1 and the first learning-path commit were written test-after. The learning-path follow-up was test-first but without a separate red commit. Stricter topic match is the first feature built with the full loop.
- Recording real search results as fixtures, so cases like "Mapbox development" fail in the suite instead of in a manual check, is the next improvement under consideration and is on hold.

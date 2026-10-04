# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repository is

Two separate things live here:

1. **Signal10** — the product. Given a topic, it returns the 10 YouTube videos most worth watching, ranked on more than lifetime view count. V1 is complete (2026-10-03): a dependency-free Node app. New work is a new feature with its own intent, not an extension of V1.
2. **A vendored copy of the Intent-Driven Starter plugin** (`plugins/intent-driven-starter/`, `.claude-plugin/marketplace.json`, `DESIGN.md`), copied from `github.com/kendallmark3/intent-driven-starter`. It is tooling for building Signal10, not part of the product. `DESIGN.md` describes the plugin, not Signal10.

## Commands

Node 20+, no dependencies, no install step, no API key.

```bash
npm start                                              # http://localhost:4310 (PORT overrides)
npm test                                               # all tests (node --test)
node --test --test-name-pattern="near-duplicate"       # one test by name
curl -G --data-urlencode "topic=AWS AgentCore" localhost:4310/api/top10   # API without the page
```

The server does not hot-reload; restart it after editing `server.js` or `src/`. Port 3000 is often taken on this machine, hence 4310.

## How features are built: red commit, then green

Every feature after V1 follows the same sequence, chosen by the repo owner on 2026-10-04:

1. Branch from `main` as `feature/<name>`.
2. Write the feature intent in `intents/<name>.md`, with numbered success criteria.
3. Write one failing test per criterion. Run the suite and confirm the new tests fail.
4. Commit the intent and failing tests alone, with a subject starting `Red:`. This commit is the proof the tests came first.
5. Implement until the suite passes, run the live searches the intent names as evidence, then commit.
6. Report anything the live check shows that the criteria did not anticipate; do not quietly widen the feature.

Do not write implementation before the red commit exists, and do not edit a red test to make it pass unless the test itself was wrong (say so in the commit message if it was).

## Signal10 architecture

One request flows through three files:

1. `src/youtube.js` — the only code that talks to YouTube. It posts to the keyless `youtubei/v1/search` endpoint three times (all time, this year, this month), walks the response for `videoRenderer` nodes, and parses YouTube's display text ("22,606 views", "3 weeks ago", "1:08:21") into numbers. A field YouTube does not return stays `null`; nothing is estimated.
2. `src/rank.js` — pure functions, no network or clock, which is why the tests need no mocks. `scoreCandidates` filters and scores, `pickDiverse` removes near-duplicate titles and caps each channel at two, `present` adds rank, headline, reason, and `rankByViews`.
3. `server.js` — `top10()` wires them together: gather, score, shortlist 15, drop any that oEmbed reports as gone, keep 10, fetch exact publish dates for those 10 only, then present.

Things that are easy to get wrong:

- `scoreCandidates` sorts full topic matches ahead of partial ones before score, so a higher score does not mean a higher rank across that boundary. `missingWords` on each result drives the "Partial match" chip and reason.
- Momentum is a percentile within the candidate pool, so a video's score depends on what else the search returned. Scores are not comparable across topics.
- Scoring uses the approximate age parsed from relative text. The exact `publishedDate` arrives after scoring and is display-only.
- The reason sentence and the headline chip are generated in `rank.js` from the signals, never by a model. Any future LLM use must not be allowed to produce titles, counts, dates, or links.
- `public/index.html` builds every card with `textContent`, because titles and channel names are untrusted text from YouTube. Keep it that way.
- A plain click on a card's thumbnail or title plays the video in a `<dialog>` via a `youtube-nocookie.com/embed` iframe; modified clicks (Cmd/Ctrl/Shift) fall through to the normal YouTube link. Playback stops because the `close` handler removes the iframe `src`.
- The `player` endpoint reports `UNPLAYABLE` for keyless callers even on playable videos, so it is used only for the publish date. Availability comes from oEmbed (403/404 mean gone; 401 only means embedding is off).

Known limitations are listed in `README.md`; update that list when one is fixed or a new one is found.

## Source of truth for Signal10

`intent.md` is the V1 contract; `README.md` is a cleaned-up summary of it. If they disagree, `intent.md` wins.

`intent.md` is a pasted conversation, so only part of it is the contract. The binding sections run from the `Signal10` heading through `V1 Stop Condition`. The text before and after (naming discussion, the list of future feature ideas) is commentary, not requirements.

### Decisions the intent left open

The intent did not prescribe a stack, a data source, or a ranking formula, and asked for the simplest thing that satisfies it. V1 chose plain Node, YouTube's keyless web endpoints, and a five-signal weighted score. Those are V1 choices, not requirements, and can be revisited by a later feature.

### Constraints that shape the design

- Every result must be a real YouTube video with real metadata. Nothing shown to the user may be invented, including by an LLM used for ranking or explanations.
- API credentials must stay out of the client and out of the repository, which means any keyed API call needs a server-side component.
- No YouTube account may be required of the user.
- Unavailable videos and obvious duplicates are filtered out.
- Each result carries a short, understandable reason for its rank.

### What "done" means for V1

The running app must demonstrate three searches: `Claude Certified Architect Foundations`, `AWS AgentCore`, and one broadly popular learning topic of the implementer's choice. For each, the results must match the topic, show ten videos when enough exist, link to playable videos, explain each ranking, and visibly differ from a sort by lifetime views. Limitations found along the way are documented.

Stop there. Accounts, saved searches, playlists, personalization, learning paths, certification plans, subscriptions, notifications, and social features are out of scope for V1.

### After V1

Each improvement becomes a feature story driven with TDD. The expected first feature is building a learning path from the Top 10.

## The plugin copy

The plugin is installed at user scope, so its skills (`/intent-driven-starter:start`, `:intent-creator`, `:execute-intent`, `:location-story`) work without the files in this repo. Editing the copy here does not change the installed plugin unless Claude Code is started with `claude --plugin-dir ./plugins/intent-driven-starter`.

To check the copy after editing it:

```bash
claude plugin validate ./plugins/intent-driven-starter
claude plugin validate ./plugins/intent-driven-starter --strict
```

The plugin's Stop hook runs `scripts/forbid-secrets.py`, which scans added lines in `git diff` and `git diff --cached` for credential patterns and blocks with exit code 2 on a match. It only sees tracked or staged changes, so a secret in an untracked file passes unnoticed until it is staged.

The plugin's own promotion rule (`DESIGN.md`): do not add a capability to the shared plugin because one project used it. Signal10-specific behavior belongs in Signal10, not in `plugins/`.

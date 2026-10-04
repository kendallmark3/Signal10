# Signal10

Signal10 finds the 10 YouTube videos most worth watching for a topic, not merely the 10 most viewed.

You enter a topic or learning goal. Signal10 returns up to 10 real YouTube videos, ranked to favor useful, relevant content over lifetime view counts, with a short reason for each pick.

## Status

**V1 is complete** (2026-10-03). The intent it was built from is in [intent.md](intent.md). Further changes are new features, each with its own intent.

## Run it

Requires Node 20 or later. There are no dependencies to install and no API key to set up.

```bash
npm start        # serves http://localhost:4310 (set PORT to change it)
npm test         # ranking and parsing tests
```

Open the page, type a topic, and press **Find the Top 10**. Click a video's thumbnail or title to play it in a modal; Close, Esc, or a click outside the modal stops it. A search can also be opened by link: `http://localhost:4310/?topic=AWS%20AgentCore`.

## What V1 does

The core experience is one flow:

```text
Topic → Signal10 ranking → Top 10 → Learning Path → explanation → play in modal or open on YouTube
```

A user can:

1. enter a topic,
2. request recommendations,
3. review the Top 10,
4. switch to a learning path ordered into foundation, core, deeper, and practical stages when title cues support them,
5. play a selected video in a modal without leaving the page,
6. open a selected video on YouTube.

The learning path is an additional view; the original Top 10 ranking remains available. Its stage suggestions and explanations are inferred from wording in video titles, not verified video contents.

Example topics:

- Claude Certified Architect Foundations
- AWS AgentCore
- Test-Driven Development with AI
- Learn Python
- Retirement investing
- Mapbox development

## What each result shows

- ranking position
- title
- thumbnail
- channel
- publication date
- duration
- view count, when available
- direct YouTube link
- a short explanation of why the video made the list
- a simple overall indication of why it ranks highly

## How ranking works

Signal10 runs the topic through three YouTube searches (all time, this year, this month) so newer videos reach the candidate pool, then scores each candidate from 0 to 100 on five signals:

| Signal | Weight | What it measures |
| --- | --- | --- |
| Topic match | 35% | How many of the topic's words appear in the title and channel, plus YouTube's own search position |
| Momentum | 25% | Views per day since posting, compared with the other candidates |
| Depth | 15% | Length, favoring 20 to 90 minutes |
| Freshness | 15% | Age, halving in value each year |
| Channel | 10% | Verified badge, and whether the channel has several videos on the topic |

Videos whose title and channel mention every topic word are full matches and always rank above partial matches, so a popular video on a neighbouring subject cannot lead the list. Partial matches only fill places that full matches leave open, and each is labelled with the topic words it does not mention.

Lifetime views are never scored directly. Videos under one minute, live streams in progress, and videos matching less than half the topic's words are dropped. Near-duplicate titles collapse to one result, and no channel takes more than two places.

Each result shows its score, the five signal bars, a one-sentence reason, and where it would sit if the same ten were sorted by views alone.

## Known limitations

- **No API key means an unofficial data source.** Results come from the same public endpoints youtube.com uses. YouTube can change or rate-limit them without notice, and a hosted deployment should move to the YouTube Data API.
- **No engagement signal.** Likes and comment counts are not in search results, so momentum stands in for audience response.
- **Topic match is word-based.** A video counts as a full match only if its title or channel contains every topic word. Abbreviations and word forms are not understood, so "AI TDD" is a partial match for "Test-Driven Development with AI", and "retire" does not match "retirement". Nothing judges what a video actually teaches.
- **Full matches always come first, even weak ones.** For a topic with a generic word, such as "Mapbox development", a low-scoring video that happens to say "development" ranks above stronger Mapbox videos that do not.
- **Learning-path stages are title-based clues.** A title can suggest an introduction, advanced treatment, or practice without proving what the video covers; check the video itself. Videos whose titles carry no such wording stay in the core stage, ordered shortest first.
- **Depth is length.** A long video scores as deep whether or not it is.
- **Freshness is always on.** It applies the same weight to "Retirement investing" as to a fast-moving technology topic.
- **Brand-new videos get noisy momentum.** A video posted hours ago is treated as one day old.
- **Age is approximate in scoring.** Ranking uses YouTube's relative text ("3 weeks ago"); the exact date is fetched only for display.
- **Some videos will not play in the modal.** Creators can disable playback outside youtube.com; those show YouTube's own message, and the modal's "Open on YouTube" link is the way through.
- **English, US results only.**

## Boundaries

- Recommendations must point to real YouTube videos; video metadata is never invented.
- Unavailable or unusable videos are excluded when they can be identified.
- Obvious duplicates are avoided.
- No YouTube account is required.
- External AI services may be used when they materially improve the result, but are not required.
- API credentials and secrets are never exposed to the client or committed to the repository.
- The simplest implementation that satisfies the intent is preferred.

## Definition of done for V1

The running application must demonstrate three searches:

1. `Claude Certified Architect Foundations`
2. `AWS AgentCore`
3. A broadly popular learning topic chosen by the implementer

For each search:

- results are returned and clearly match the subject,
- ten results are shown when enough suitable videos exist,
- each result links to a real, playable YouTube video,
- a selected result plays in the modal,
- each result has an understandable reason for its ranking,
- the ordering shows Signal10 is doing more than sorting by lifetime view count.

Important limitations found during the first implementation are documented.

The question V1 has to answer: can we type a learning subject and get back ten videos we would rather watch than the first ten results from ordinary YouTube search?

## Out of scope for V1

Accounts, saved searches, playlists, personalization, certification plans, learning paths, subscriptions, notifications, and social features. These should emerge as later features based on what V1 teaches.

## What comes next

Signal10 follows a progressive-intent approach: get a real V1 running, learn from it, then drive each improvement as a feature story with TDD. The likely first feature is building a learning path from the Top 10.

## Repository layout

| Path | Contents |
| --- | --- |
| [intent.md](intent.md) | The V1 intent this README is drawn from |
| [intents/](intents/) | One intent per feature built after V1 |
| [server.js](server.js) | HTTP server: the page and `/api/top10` |
| [src/youtube.js](src/youtube.js) | Fetches and parses real video metadata from YouTube |
| [src/rank.js](src/rank.js) | Scoring, de-duplication, and explanations |
| [src/learning-path.js](src/learning-path.js) | Title-cue learning-path staging and explanations |
| [public/index.html](public/index.html) | The single-page interface |
| [test/](test/) | Tests for ranking, parsing, and learning paths |
| [DESIGN.md](DESIGN.md) | Design notes for the Intent-Driven Starter plugin |
| [plugins/intent-driven-starter/](plugins/intent-driven-starter/) | Claude Code plugin: skills, agents, and a secret-scan hook |
| [.claude-plugin/](.claude-plugin/) | Marketplace definition for the plugin |

To build the next feature with the plugin, open Claude Code in this folder and run:

```text
/intent-driven-starter:intent-creator <your feature>
/intent-driven-starter:execute-intent
```

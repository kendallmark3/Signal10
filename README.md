# Signal10

Signal10 finds the 10 YouTube videos most worth watching for a topic, not merely the 10 most viewed.

You enter a topic or learning goal. Signal10 returns up to 10 real YouTube videos, ranked to favor useful, relevant content over lifetime view counts, with a short reason for each pick.

## Status

**V1 is complete** (2026-10-03). The intent it was built from is in [intent.md](intent.md). Further changes are new features, each with its own intent.

## Run it

Requires Node 20.12 or later. Run `npm install` once.

Settings live in a file named `.env` next to `server.js` (git-ignored), or in the real environment:

```text
SIGNAL10_USERNAME=your-username
SIGNAL10_PASSWORD=your-password
ANTHROPIC_API_KEY=your-key-here
```

- **`SIGNAL10_USERNAME` and `SIGNAL10_PASSWORD` are required.** The whole site sits behind a sign-in screen, and the server refuses to start without both. To change them, edit the values and restart; everyone signed in under the old ones is signed out.
- **`ANTHROPIC_API_KEY` is optional.** Without it, Architect View says it is not set up and everything else works.
- **`HOST` and `PORT` are optional.** The server listens on `127.0.0.1:4310` unless told otherwise; a deployment sets `HOST=0.0.0.0`.

When deploying, serve the site over HTTPS (for example behind a load balancer or CloudFront). Over plain HTTP the password and session cookie travel unencrypted.

```bash
npm start        # serves http://localhost:4310 (set PORT to change it)
npm test         # ranking and parsing tests
```

Open the page, type a topic, and press **Find the Top 10**. Click a video's thumbnail or title to play it in a modal; Close, Esc, or a click outside the modal stops it. A search can also be opened by link: `http://localhost:4310/?topic=AWS%20AgentCore`.

## Deploy to AWS

```bash
npm run deploy:aws   # creates or updates the site, then prints its HTTPS URL
```

It needs the AWS CLI, `zip`, and an AWS CLI profile named `mkendall` (set `AWS_PROFILE` to use another). The sign-in credentials and the API key are read from `.env` and sent to AWS as the function's environment.

The site runs as one Lambda function, `signal10`, behind a public Function URL, with the [AWS Lambda Web Adapter](https://github.com/awslabs/aws-lambda-web-adapter) layer in front of the unchanged `server.js`. The first run also creates the execution role `signal10-lambda`. Run the command again after any change; it updates the function in place and the URL stays the same. Changing a credential in `.env` takes effect on the next deploy.

To remove it: `aws lambda delete-function --function-name signal10 --profile mkendall`, then detach the policy from the role and delete the role.

## What V1 does

The core experience is one flow:

```text
Topic → Signal10 ranking → Top 10 → Learning Path → Architect View → play in modal or open on YouTube
```

A user can:

1. enter a topic,
2. request recommendations,
3. review the Top 10,
4. switch to a learning path ordered into foundation, core, deeper, and practical stages when title cues support them,
5. open Architect View, where Claude turns the Top 10 into a short plan for an architect: what to watch in order, prerequisites, what can be skipped, key concepts, architecture implications, risks, and a next step,
6. play a selected video in a modal without leaving the page,
7. open a selected video on YouTube.

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

Videos whose title and channel mention every topic word are full matches. A full match gets a 15-point head start when the list is ordered, so a popular video on a neighbouring subject cannot lead the list, while a much stronger partial match can still rank above a weak full one. Each partial match is labelled with the topic words it does not mention. The score shown on a card is the raw score, without the head start, so a lower-scoring full match can sit above a higher-scoring partial one.

Lifetime views are never scored directly. Videos under one minute, live streams in progress, and videos matching less than half the topic's words are dropped. Near-duplicate titles collapse to one result, and no channel takes more than two places.

Each result shows its score, the five signal bars, a one-sentence reason, and where it would sit if the same ten were sorted by views alone.

## Free reading

Each search also asks [Open Library](https://openlibrary.org) for books on the same topic and lists up to five under the videos. A book is shown only if Open Library says it can be read for free, and the label says which kind: **Free to read online**, or **Free to borrow with an Open Library account**. Every link goes to the book's own Open Library page. Architect View receives the same short list and may place a book in its sequence as a Read step between videos; it may also use none.

## Known limitations

- **Architect View has not watched the videos.** Claude sees only each video's rank, title, channel, length and age, and adds its own knowledge of the topic. Its concepts, implications and risks can be out of date for a new technology, and its guesses about what a video covers can be wrong. Every video it names is one of Signal10's Top 10; it cannot add others.
- **Sign-in is one shared username and password.** There are no accounts, no password reset, and the password is stored as plain text in the server's environment. Five wrong attempts in a row lock sign-in for a minute for everyone, including the owner.
- **Architect View costs money and takes time.** Each new topic makes one call to Claude Opus 5.5 on your API key and can take up to a minute. The result is kept in memory for 15 minutes, so reopening it is free.
- **No YouTube API key means an unofficial data source.** Results come from the same public endpoints youtube.com uses. YouTube can change or rate-limit them without notice, and a hosted deployment should move to the YouTube Data API.
- **No engagement signal.** Likes and comment counts are not in search results, so momentum stands in for audience response.
- **Topic match is word-based.** A video counts as a full match only if its title or channel contains every topic word. Abbreviations and word forms are not understood, so "AI TDD" is a partial match for "Test-Driven Development with AI", and "retire" does not match "retirement". Nothing judges what a video actually teaches.
- **The full-match head start is a fixed 15 points.** It is a compromise: large enough to push sibling certifications down the "Claude Certified Architect Foundations" list, but one still appears at #10, and in "Mapbox development" a weak video that says "development" still sits mid-list above a few stronger ones.
- **Learning-path stages are title-based clues.** A title can suggest an introduction, advanced treatment, or practice without proving what the video covers; check the video itself. Videos whose titles carry no such wording stay in the core stage, ordered shortest first.
- **Depth is length.** A long video scores as deep whether or not it is.
- **Freshness is always on.** It applies the same weight to "Retirement investing" as to a fast-moving technology topic.
- **Brand-new videos get noisy momentum.** A video posted hours ago is treated as one day old.
- **Age is approximate in scoring.** Ranking uses YouTube's relative text ("3 weeks ago"); the exact date is fetched only for display.
- **Some videos will not play in the modal.** Creators can disable playback outside youtube.com; those show YouTube's own message, and the modal's "Open on YouTube" link is the way through.
- **English, US results only.**
- **Free reading is thin for new technology.** Open Library has no free copy of most recent technical books, so topics such as "Agentic Workflows", "Kubernetes" or "AWS AgentCore" get no reading at all, and what does appear is often ten or more years old. Established subjects (Python, machine learning, retirement investing) do much better.
- **Most free reading is borrow, not open.** Books that anyone can read without an account are rare; most results need a free Open Library account to borrow, and a borrowed copy can have a waiting list. The label on each book says which it is.
- **A book must name the topic in its title.** Every word of the topic has to appear in the title or subtitle. That keeps out loose matches (The Time Machine for "machine learning") and also keeps out good books with different wording.
- **Nobody has read the books.** Signal10 does not open them and Claude judges them from title, author and year alone.
- **Recent searches live in one browser.** The five most recent are kept in that browser's local storage, so they do not follow you to another device or browser, and a private window forgets them.
- **A misspelled search is searched as typed.** "Did you mean" is YouTube's own correction, offered beside the results and never applied. The typed phrase is still what Signal10 matches titles against, so a misspelling usually returns fewer results until the suggestion is clicked. The misspelled phrase is also kept in Recent.
- **Typo help depends on YouTube.** When YouTube offers no correction, Signal10 suggests nothing; it has no dictionary of its own.
- **The logo has one version.** Its lettering is dark, so the dark theme shows it on a light plate rather than using artwork drawn for a dark background.
- **No exact publish dates on AWS.** YouTube's `player` endpoint returns no publish date to requests from AWS addresses, so the deployed site shows only the relative age ("3 weeks ago"). Ranking is unaffected, since it never used the exact date.
- **The sign-in lockout is per Lambda instance on AWS.** The failed-attempt counter lives in memory, so when Lambda runs more than one instance each keeps its own count, and a new instance starts at zero.
- **Secrets on AWS are Lambda environment variables.** They are encrypted at rest but readable by anyone with access to the function's configuration in the AWS account.

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
| [server.js](server.js) | HTTP server: the page, `/api/top10` and `/api/architect` |
| [src/architect.js](src/architect.js) | Architect View: the one Claude call and the checks on its reply |
| [src/auth.js](src/auth.js) | Sign-in: credential check, signed session, lockout |
| [src/youtube.js](src/youtube.js) | Fetches and parses real video metadata from YouTube |
| [src/rank.js](src/rank.js) | Scoring, de-duplication, and explanations |
| [src/openlibrary.js](src/openlibrary.js) | Finds free books for the topic on Open Library |
| [src/learning-path.js](src/learning-path.js) | Title-cue learning-path staging and explanations |
| [public/index.html](public/index.html) | The single-page interface |
| [public/recent.js](public/recent.js) | Recent searches: the list rules and local-storage handling |
| [public/login.html](public/login.html) | The sign-in screen |
| [public/logo.webp](public/logo.webp) | The logo as served, made from [assets/logo-source.png](assets/logo-source.png) |
| [scripts/deploy-aws.js](scripts/deploy-aws.js) | `npm run deploy:aws`: deploys to AWS Lambda |
| [run.sh](run.sh) | Lambda entry point; starts `server.js` |
| [test/](test/) | Tests for ranking, parsing, and learning paths |
| [DESIGN.md](DESIGN.md) | Design notes for the Intent-Driven Starter plugin |
| [plugins/intent-driven-starter/](plugins/intent-driven-starter/) | Claude Code plugin: skills, agents, and a secret-scan hook |
| [.claude-plugin/](.claude-plugin/) | Marketplace definition for the plugin |

To build the next feature with the plugin, open Claude Code in this folder and run:

```text
/intent-driven-starter:intent-creator <your feature>
/intent-driven-starter:execute-intent
```

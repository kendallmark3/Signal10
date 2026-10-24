# Feature: Native iOS app

Source: the owner's "Signal10 iOS — Intent" note, pasted on 2026-10-24. This file is the contract drawn from it.

## Intent

Signal10 only exists as a web page. On an iPhone that means a browser tab, a sign-in form sized for a desktop, and a learning path that forgets which videos were already watched the moment the tab closes.

Make Signal10 a native iPhone app that asks one question, "What do you want to learn?", and turns the existing Top 10 into a path the user can work through: start here, watch, come back, see what is next.

The server stays the product. The app is a client of the same `/login`, `/api/top10` and `/api/architect` routes the web page uses. Ranking, learning-path staging, reasons, Architect View and the model call stay on the server, unchanged.

## Inputs

- The running Signal10 server, locally or the deployed Lambda Function URL.
- The shared username and password the server already requires.
- The topic the user types.
- `public/recent.js`, whose rules the app's recent searches follow.
- `public/logo.webp` and `assets/logo-source.png` for the app's identity.

## Outputs

- `ios/`: a SwiftUI app (iOS 18+), its unit tests, and a committed Xcode project, so a clean checkout builds without extra tools.
- Home: the question, a topic field, recent searches and example topics.
- Results: an "Up next" card, the learning path grouped by the server's stages, a switch to the original Top 10 ranking, YouTube's "Did you mean", free reading, and Architect View on request.
- A player sheet that plays the video in an embedded YouTube player, says why it was picked, links out to YouTube, and moves on to the next step.
- Watched videos remembered per topic on the device.

## Decision: sign-in

The server signs every route behind one shared username and password (`src/auth.js`). The owner's note says not to require an account unless the product genuinely requires one. It does today, so the app keeps it: the user types the same credentials once, the server's session cookie is kept by the system cookie store for its seven days, and the password itself is not stored. Nothing is compiled into the app but the server's address. Replacing the shared sign-in with something suitable for public App Store users is a later feature.

## Decision: model boundary

The app never names a model provider. Architect View is whatever `/api/architect` returns, so moving the server from Anthropic to another provider or a router changes nothing in the app. Architect View is called only when the user opens it, so a search costs no model call, and the server's 15-minute cache still serves a reopen.

## Success criteria

All in `ios/Signal10Tests`, run with `xcodebuild test`:

1. A real `/api/top10` reply, recorded from the running server, decodes: ten results with rank, title, channel, thumbnail, duration, score, headline, reason and rank by views, plus the learning path with step, stage and path reason.
2. A reply whose optional fields are null or missing (views, duration, exact date, thumbnail, suggestion, reading authors and cover) decodes, and those fields stay empty rather than being given a value.
3. The learning path groups into the server's stages in the order they first appear, keeping the server's step order inside each stage.
4. Topics are cleaned as the server cleans them (trimmed, inner spaces collapsed), and a topic shorter than 2 or longer than 120 characters sends no request.
5. Sign-in posts the username and password as a form to `/login` without following the redirect. A redirect to `/` is success; `/login?error=1` is a wrong password; `/login?locked=1` is the lockout.
6. An API reply of 401 means signed out. Any other error reply shows the server's own `error` message. Architect View's `not_configured` is reported as its own case.
7. Recent searches follow `public/recent.js`: newest first, at most five, a repeat (ignoring case and spacing) moves to the front, a blank search is not kept, and unreadable storage gives an empty list.
8. Watched videos are remembered per topic, ignoring letter case, and "Up next" is the first unwatched step of the learning path, or nothing when every step is watched.
9. The player is built from the video id alone: an id that is not 11 YouTube id characters gives no player, and a valid one gives a `youtube-nocookie.com/embed` address that plays inline.
10. The app's settings hold the server address and no API key or model setting.

## Constraints

- No change to ranking, learning-path staging, Architect View, sign-in rules or the web page. The server's tests keep passing.
- No third-party Swift packages.
- No API key, model name or provider in the app. Nothing the app shows is invented: every title, channel and link comes from the server's reply.
- Titles and channel names are untrusted text. SwiftUI `Text` renders them as plain text; they are never interpreted as markup or used to build a link.
- Videos play through YouTube's own embedded player or open in YouTube, as the web page does.

## Evidence required

- `npm test` passes and `xcodebuild test` passes.
- In the iOS Simulator against the running server: sign in, search `AWS AgentCore` and one other topic, see ten results, play one, mark it watched, come back and see "Up next" move on. Screenshots of Home, Results, the player and Architect View (or its "not set up" message when no key is configured).
- The built `.app` searched for `sk-ant`, `ANTHROPIC` and `api_key`: no matches.
- Real iPhone: a manual check by the owner, since it needs their device and signing; steps in `ios/README.md`.

## Stop condition

The app signs in, searches, shows the path and the ranking, plays and opens videos, remembers what was watched, and shows Architect View and free reading. Public accounts, push notifications, offline caching, iPad layouts, widgets, sharing and App Store submission are later features.

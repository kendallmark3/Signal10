# Feature: iOS settings, help and favorites

Source: the owner, 2026-10-24, after using the iOS app on a real iPhone: "let's get a setting screen … a how-to or a help … maybe save some favorites."

## Intent

The iPhone app does its one job, but it has nowhere to change how it behaves, nothing that explains how Signal10 picks its videos, and no way to keep a good video once the search is gone. Every iOS app is expected to have a settings screen, and a learning tool needs a place to keep what was worth watching.

Add a Settings screen with a few settings that change real behaviour, a Help screen that explains the app in plain words, and favorites: star a video and find it again from Home.

## Inputs

- The existing iOS app (`ios/`), its stored recent searches and watched progress.
- The server's own labels: the five ranking signals in `README.md` and the four learning-path stages in `src/learning-path.js`.
- The developer credit from `intents/credit.md`: "Developed by Mark Kendall at repogenic.com".

## Outputs

- A Settings screen, opened from a gear on Home, with:
  - **Learning**: open results in the Learning path or the Top 10; autoplay videos when opened.
  - **Your data**: clear recent searches, clear watched progress, clear favorites.
  - **Account**: the server in use, and Sign out.
  - **About**: version, Help, and the developer credit.
- A Help screen: how to use the app, what the ranking signals mean, what the path stages mean, Architect View, and tips.
- A star on the player sheet and in each video's long-press menu. A Favorites row on Home opens the saved list; tapping a favorite plays it, and each can be removed.

## Success criteria

All in `ios/Signal10Tests`:

1. A favorite keeps only the server's fields for the video (id, title, channel, thumbnail, duration, link) plus the topic it was found under and when it was saved.
2. Favorites are newest first. Starring a video that is already a favorite, from any topic, does not add a second copy; unstarring removes it.
3. Favorites survive being stored and read back, and unreadable storage gives an empty list rather than an error.
4. Settings start as: open results in the Learning path, autoplay on. A changed setting is read back after storing.
5. With autoplay off the player address asks YouTube not to autoplay; with it on, it does.
6. Each Clear action removes only its own data: clearing watched progress removes every topic's progress and leaves recent searches and favorites; clearing recent searches and clearing favorites likewise touch nothing else.
7. Help names the five ranking signals and the four learning-path stages exactly as the server labels them.
8. About carries the app version and the credit "Developed by Mark Kendall at repogenic.com", linking to `https://repogenic.com`.

## Constraints

- No server change, no new route, no third-party package. Everything new is stored on the device.
- A favorite stores only what the server sent; nothing is invented or fetched again.
- Settings change behaviour in the app only. Ranking, the path and Architect View stay the server's.
- No new data leaves the phone.

## Evidence required

- `npm test` and `xcodebuild test` pass.
- The UI test, against a running server: star the playing video, see it under Favorites on Home and play it from there; open Settings and Help. Screenshots of Settings, Help and Favorites.
- A build on the owner's iPhone.

## Stop condition

Settings, Help and favorites work on the phone. Syncing favorites across devices, folders or notes on favorites, sharing, notifications, themes and account management are later features.

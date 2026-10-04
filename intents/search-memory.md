# Feature: Search memory and typo assistance

Source: [intentv3.md](intentv3.md), the owner's pasted note. This file is the contract drawn from it.

## Intent

Every visit to Signal10 starts from an empty box. Topics the owner searched yesterday have to be typed again, and a small slip such as `visual merchandizing manager` is searched as typed with no hint that `merchandising` was probably meant.

Remember the five most recent searches in the browser and offer them as one-click chips. When a phrase looks misspelled and the confidence is high, offer the corrected phrase as a clickable "Did you mean", without ever replacing what the user typed.

## Inputs

- The phrase the user searched.
- The browser's local storage.
- The search Signal10 already sends to YouTube. A quick look at real data on 2026-10-04 showed that YouTube's reply names its own spelling correction (`showingResultsForRenderer` or `didYouMeanRenderer`, each with a `correctedQuery`). It did so for `visual merchandizing manager`, `pyhton for beginers`, `kubernets tutorial`, `mapbox developmnet` and `retirment investing`, and not for `AWS AgentCore` or `Claude Certified Architect Foundations`.

## Outputs

- A "Recent" row of up to five chips under the example topics. Clicking one reruns that search.
- A "Did you mean: …?" line under the search status when there is a confident correction. Clicking it searches the corrected phrase.

## Decision: where the correction comes from

The source note prefers a browser-side spelling check and leaves the solution to the implementer. A browser-side check needs a dictionary, which is either large or wrong about names like AgentCore and Mapbox. YouTube's correction arrives in a reply Signal10 already receives, costs no extra request and no model call, and knows product names. So the suggestion comes from the server with the results, not before the search runs. "High confidence" means YouTube offered a correction; when it offers none, Signal10 suggests nothing.

## Success criteria

Recent searches (`public/recent.js`, pure functions, unit tested):

1. The newest search comes first, and at most five are kept: a sixth unique search drops the oldest.
2. Searching a remembered topic again moves it to the front rather than adding a duplicate. Topics that differ only in letter case or spacing count as the same.
3. A blank search is not saved.
4. The list survives being written to storage and read back, and storage that is missing, full or holds something unreadable gives an empty list instead of an error.
5. The page loads `recent.js` from the server, which serves it as JavaScript to a signed-in visitor and refuses it without a session; the page has a place for the recent row.

Typo assistance (`src/youtube.js`, pure functions, unit tested):

6. A correction is read from YouTube's reply in both forms it takes, and a reply without one gives none.
7. No suggestion is made when the correction is the phrase the user typed, ignoring letter case and spacing.
8. The page has a "Did you mean" line that is hidden until there is a suggestion.

## Constraints

- No new dependency, no database, no model call, no extra request to YouTube.
- The typed phrase is searched as typed. A suggestion is only ever offered.
- Suggestion text comes from YouTube and recent topics come from storage, so both are rendered with `textContent`, like every other untrusted string on the page.
- The example topics stay. Ranking, learning path, Architect View and playback do not change.

## Evidence required

- `npm test` passes.
- In a real browser against the running app: five searches, reload, all five still shown; a sixth drops the oldest; reusing an older one moves it to the front; `visual merchandizing manager` shows the suggestion and its own results; clicking the suggestion searches the corrected phrase. Then the same suggestion check on the deployed site.

## Stop condition

Recent searches and the suggestion line work on the main page. Clearing history, syncing it across devices, suggesting before the search is sent, and retiring the example topics are later features.

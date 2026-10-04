# Feature: Architect View

The intent for this feature is [intentv2.md](intentv2.md), as written by the repo owner. This file adds only what [TDD.md](../TDD.md) needs on top of it: numbered, testable success criteria and the evidence to collect.

## Success criteria

Reasoning step (`src/architect.js`, tested without the network by passing in a fake Anthropic client):

1. The request sent to the model contains the topic and, for each ranked result, only its rank, title, channel, duration and published text. No ids, URLs, thumbnails, scores or view counts are sent.
2. A valid model reply becomes an Architect View with: a summary, a learning sequence, prerequisites, material that can be skipped, key concepts, architecture implications, risks and tradeoffs, and a next step.
3. Every video in the sequence and skip lists is resolved from the Signal10 results by rank. Its id, title and URL come from Signal10, never from the model's reply.
4. A reference to a rank that is not in the results is dropped.
5. A video the model lists in both the sequence and the skip list appears only in the sequence, and a video repeated within a list appears once.
6. Text lists are trimmed, blank entries are removed, and each list is capped at six items so the view stays scannable.
7. A reply with no usable learning sequence is reported as a failure, not shown as an empty view.
8. With no API key configured, the model is never called and the result is a "not configured" error.
9. A model refusal, an API or network error, and a reply that is not valid JSON each produce an error with a message fit to show the user.
10. A successful run calls the model exactly once.

Server and page (checked live, not by unit tests):

11. `/api/top10` and the Top 10, learning path and modal behave exactly as before, with or without an API key.
12. The Anthropic API key is read from the server environment only and never appears in anything sent to the browser.
13. After a search, the user can open Architect View; videos named in it open the existing modal player.
14. If Architect View cannot be produced, the page says why in plain words and the rest of the page keeps working.

## Evidence required

- Tests for criteria 1 to 10, committed failing before the implementation.
- Live, without a key: a search works, and Architect View shows its fallback state.
- Live, with a key: one technical search showing Architect View with a sequence, prerequisites, architecture implications, skippable material and a next step.

## Stop condition

Stop when the criteria pass and both live checks are done. No chat, no follow-up questions to the model, no saved views, no transcript fetching.

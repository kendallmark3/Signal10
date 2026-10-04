# Feature: Stricter topic match

## Intent

When a topic names something specific, the Top 10 should be about that thing, not its neighbours.

Today a search for "Claude Certified Architect Foundations" returns videos about the Developer and Associate certifications, because they share three of the four topic words and score well on momentum. A search for "Test-Driven Development with AI" is led by a video on spec-driven development for the same reason.

## Inputs

The topic the user typed, and the candidate videos already gathered for it (title, channel, and the existing signals).

## Outputs

- The same Top 10 list, ordered so that full matches come before partial matches.
- Each result says which topic words, if any, its title and channel do not mention.

## Success criteria

1. A video whose title and channel cover every topic word is a **full match**. Every full match ranks above every partial match, whatever their scores.
2. When ten or more full matches are available, no partial match appears in the Top 10.
3. When fewer than ten full matches are available, partial matches fill the remaining places, after all full matches, in score order.
4. A partial match is labelled "Partial match" and its reason names the missing topic words as the user typed them.
5. A full match carries no partial-match label and lists no missing words.
6. The channel name counts toward the match, so "AgentCore Runtime" from "AWS Developers" is a full match for "AWS AgentCore".
7. Single-word topics behave exactly as before.

## Constraints

- Deterministic code only; no model decides what a video is about.
- No change to the five signals, their weights, or the de-duplication and per-channel rules.
- No new dependencies.

## Evidence required

- Tests for each success criterion, committed failing before the implementation.
- Live searches for "Claude Certified Architect Foundations" and "Test-Driven Development with AI" showing full matches first.

## Stop condition

Stop when the criteria pass and the two live searches are checked. Synonyms, abbreviations ("TDD"), and better word stemming ("retire" vs "retirement") are separate features.

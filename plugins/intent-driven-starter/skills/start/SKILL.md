---
description: Start work in an unfamiliar or existing repository using the tested repo-aware Intent-Driven Engineering posture. Use at the beginning of a feature, bug fix, refactor, or onboarding session.
---

# Start — Repo-Aware Onboarding

Begin by understanding the repository before proposing architecture or editing code.

## Read first
1. Locate and read repository guidance such as `CLAUDE.md`, `AGENTS.md`, README files, current intent/spec/feature files, and relevant package manifests.
2. Identify the current implemented state. Distinguish working code from roadmap/spec text.
3. Find the smallest set of files that actually implement the requested behavior.
4. Reuse existing patterns before introducing new frameworks, services, agents, workflows, or dependencies.

## Establish the work contract
State internally and preserve:
- Goal / user intent
- Relevant inputs and current-state evidence
- Expected outputs
- Success criteria / acceptance criteria
- Constraints
- Validation evidence required
- Stop conditions

Do not require the user to rewrite information already present in the repository or conversation.

## Architecture posture
- Goal-oriented execution is the default.
- Use procedural orchestration only where ordering, gates, side effects, retries, recovery, or failure consequences require it.
- Use a Skill for reusable process knowledge.
- Use a Hook for deterministic non-bypassable enforcement.
- Use a Tool for an external action.
- Use MCP only when governed access to an external system is actually needed.
- Use a subagent only for concrete specialization, isolation, or useful parallel work.
- Prefer the minimum sufficient architecture.

## Context policy
Treat every agent/tool/workflow boundary as an information contract.
Pass the minimum sufficient context:
- intent
- constraints
- relevant state
- evidence/source metadata when verification may matter
- expected output shape
- validation and stop conditions

Prefer references or summarized deltas over raw conversation history when retrieval is cheap.

## Before editing
Produce a concise understanding of:
- what is already working,
- what must change,
- what must not change,
- how the change will be validated.

Then proceed with the smallest safe change.

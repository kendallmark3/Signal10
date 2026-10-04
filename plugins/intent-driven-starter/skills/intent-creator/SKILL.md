---
description: Create or refine an intent file using the established Intent Creator standard. Use when the user asks for an intent, feature intent, implementation intent, or says "intent creator".
---

# Intent Creator

Create an implementation-ready intent that is strong enough for autonomous repo-aware execution without overengineering.

## Required pillars
Every intent must make these explicit:
1. Intent / Goal
2. Inputs / Context
3. Outputs
4. Success Criteria

## Add when relevant
- Constraints
- Current state / repo assumptions
- Acceptance criteria
- Validation / evidence
- Stop conditions
- Delivery expectations

## Execution posture
- Minimum sufficient architecture.
- Goal-oriented by default.
- Procedural control only where ordering, gates, side effects, retries, recovery, or failure cost justify it.
- Smallest safe change.
- Reuse repository patterns before introducing new components.
- Delta mode is acceptable when extending an existing intent.

## Capability selection
Do not use architecture by habit.
- Skill: reusable "how we do this" knowledge.
- Hook: deterministic rule that must not be bypassed.
- Tool: external action.
- MCP: governed access to external tools/data.
- Subagent: specialization, isolation, or genuinely useful parallel reasoning.
- Workflow/orchestrator: only when coordination or procedural control is necessary.

Do not bring a hook to a skill job, a skill to an agent job, or an agent to a simple goal-oriented task.

## Context engineering
For each boundary, define the minimum sufficient handoff.
Distinguish:
- intent
- constraints
- state
- evidence

Prefer structured handoffs. Pass source metadata when downstream verification matters. Prefer references to full content when cheap retrieval is available.

## Validation
Require observable evidence, not claims. Validation should match the repository's real test/build/lint/runtime conventions.

## Stop
Stop when success criteria are met and evidence is collected. Do not continue adding architecture, polish, abstractions, or adjacent features that were not requested.

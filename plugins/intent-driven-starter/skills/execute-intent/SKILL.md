---
description: Execute an existing feature or intent file with the tested Plan → refine → delta → implement → validate discipline. Use for repo-aware implementation work.
---

# Execute Intent

Treat the repository and the current intent as the source of truth.

## 1. Understand
- Read repo guidance and the current intent/spec.
- Determine implemented state from code and tests, not aspirational prose alone.
- Identify the smallest affected surface.
- Preserve existing public behavior unless the intent explicitly changes it.

## 2. Refine only what is missing
Before implementation, resolve gaps only when they block correct work:
- ambiguous acceptance criteria,
- missing interface contracts,
- required side-effect ordering,
- required validation.

Do not redesign the system merely because a different design is possible.

## 3. Delta
Express the implementation as a small delta from current state:
- files/components to change,
- files/components intentionally unchanged,
- new dependency only if unavoidable,
- risks and rollback/recovery considerations only where relevant.

## 4. Implement
- Follow existing repository patterns.
- Keep AI/reasoning responsible for interpretation and suggestions.
- Keep deterministic code responsible for state, validation, security boundaries, persistence, coordinates/identifiers, and irreversible actions.
- Do not fabricate external facts or tool results.
- Do not bypass hooks or runtime validation.

## 5. Context passing
For subagents/tools, pass only what the recipient needs.
Use structured handoffs where practical.
Never pass credentials, unrelated history, or large raw context without a concrete need.

## 6. Validate
Use the repository's actual checks: tests, type checks, lint, builds, contract validation, focused runtime checks, or equivalent.
Collect evidence for each success criterion.

## 7. Stop
Stop when the requested outcome is working and validated.
Do not "graduate" a local solution into a shared service, framework, agent, MCP server, or workflow unless repeated use or a hard requirement justifies promotion.

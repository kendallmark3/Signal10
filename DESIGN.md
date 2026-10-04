# Design Notes

This v1 intentionally packages only the reusable operating system discovered in LocationMaster.

## Kept
- repo-aware source-of-truth behavior
- intent pillars and stop conditions
- smallest-safe-change posture
- goal-oriented default
- procedural control only when justified
- skills for reusable knowledge
- hooks for deterministic enforcement
- subagents only for specialization/isolation
- minimum-sufficient context contracts
- optional location truth/composition rules

## Left out on purpose
- the LocationMaster React/FastAPI application
- Amazon Location Service
- MapLibre/Mapbox
- Anthropic API runtime calls
- the Fetch MCP joke/capability demo
- AWS CDK
- Postgres/PostGIS
- Cognito/S3
- app-specific export hooks/contracts

These are useful in LocationMaster, but they are not universal project dependencies.

## Promotion rule
Do not add a capability to this shared plugin because one project used it. Promote it only when multiple projects need the same reusable behavior and the abstraction is stable.

---
description: Apply the tested LocationMaster rules when a project involves maps, geocoding, story points, place search, map composition, or location narratives. Do not use for unrelated projects.
---

# Location Story — Tested Rules

This skill is optional and should activate only for location/map work.

## Location truth
- Never invent latitude/longitude.
- Searched addresses and places must resolve through the configured geocoder/provider tool.
- Persist coordinate provenance where the application stores coordinates.
- A deliberate user map click may be accepted as direct coordinate input and marked as such.
- LLM output is never coordinate authority.
- Ambiguous geocoder results require user selection or an explicit deterministic disambiguation rule.
- Changing labels, categories, notes, or symbols must not silently move coordinates.

## Story composition
- Preserve the user's original intent.
- Keep the subject location visually primary.
- Prefer a small useful story over visual clutter.
- Keep symbol vocabulary small and consistent.
- Categories are presentation metadata, not geographic truth.
- User presentation overrides beat AI suggestions.
- Suggested places remain suggestions until provider/tool evidence confirms them.

## Separation of responsibilities
AI may:
- interpret intent,
- suggest story goals/categories,
- draft grounded narrative from confirmed points.

Deterministic services must own:
- coordinates,
- persistence,
- authentication,
- validation,
- export boundaries,
- rendering mechanics.

## Export
Do not bypass export validation or coordinate-provenance checks.
Prefer exporting the actual rendered map when the client renderer supports it; a schematic fallback should be clearly identified as such.

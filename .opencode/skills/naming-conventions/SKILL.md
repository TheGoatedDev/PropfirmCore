---
name: naming-conventions
description: PropfirmCore naming conventions. Use when adding or changing OpenAPI routes, tags, HTTP handlers, or API surface.
---

# Naming conventions

Load this skill for any API / OpenAPI work in this repo.

## OpenAPI tags

**Title Case.** Spaces stay. Each word starts with a capital.

Yes: `Trader`, `Firm Admin`, `Market Data Ingest`, `Authentication`, `Authentication - Admin`

No: `trader`, `firmAdmin`, `FirmAdmin`, `firm admin`

Hyphenated groups: spaces around `-` (`Authentication - Admin`).

Put tag names in `tags` in `apps/server/src/openapi.ts`. Do not hardcode a different spelling on a route.

Every tag needs a description (full sentence) in `tagMeta`.

## More rules

Add them here when they exist. Do not invent extra conventions.

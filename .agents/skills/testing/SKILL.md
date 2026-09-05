---
name: testing
description: PropfirmCore test layers. Use when adding or changing unit, integration, or e2e tests.
---

# Testing

Load this skill before adding a test.

## Layers

Pick by **contract**, not by suite name. `smoke` / `regression` are Playwright projects, not layers.

### Unit

Pure functions. No I/O.

Yes: `packages/domain`, config parse, permission math.
No: postgres, NATS, `listen`, `fetch` to a live server, browser.

Runner: Vitest `*.test.ts` next to the code. `pnpm test`.

### Integration

HTTP / worker / db / NATS contract. No browser.

Yes: ingest snapshot settles on worker (`settle.int.test.ts`).
No: `page.goto`, asserting SPA copy.

Runner: Vitest `*.int.test.ts`. `pnpm test:int` against a live API+worker. Default `pnpm test` excludes these.

### E2E

Browser user contract.

Yes: navigation, visible copy, trader+admin UI flow.
No: API-only, worker settle.

Rule: **no `page.goto` → not e2e.**

Runner: Playwright. `pnpm e2e`. `smoke` = golden path (signup → buy 50k → admin complete → active). `regression` = other UI.

## Default

If unsure: unit. Then integration. E2e last.

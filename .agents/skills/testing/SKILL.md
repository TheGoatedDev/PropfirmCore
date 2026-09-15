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

Runner: Vitest `*.test.ts` next to the code. `pnpm test:unit`.

### Integration

HTTP / worker / db / NATS contract. No browser.

Yes: ingest snapshot settles on worker (`settle.int.test.ts`).
No: `page.goto`, asserting SPA copy.

Runner: Vitest `*.int.test.ts`. `pnpm test:int` boots postgres+NATS (Testcontainers) then API+worker. Docker required.

### E2E

Browser user contract.

Yes: navigation, visible copy, trader+admin UI flow.
No: API-only, worker settle.

Rule: **no `page.goto` → not e2e.**

### E2E locators

Stable hook is `data-testid`. Playwright: `page.getByTestId("…")`.

- kebab-case. Repeat rows: entity or index — `broker-id-{i}`, `product-broker-{productIndex}-{brokerId}`.
- No CSS `#id`, `[id^=]`, `label[for=]`, or `locator("..")` parent walks.
- Unique copy (`getByRole("heading")`) is OK only when not acting on a control. Fields, buttons, checkboxes, row actions = testid.
- Put the testid on the node the test clicks or fills, not a wrapper Base UI hides (`aria-hidden` checkbox).

Runner: Playwright. `pnpm test:e2e` boots postgres+NATS (Testcontainers) then API+worker+SPAs. Docker required. `smoke` = golden path (signup → buy 50k → admin complete → active). `regression` = other UI.

`pnpm test` = unit then int then e2e.

## Bugs

Confirmed bug → write a failing test that reproduces it, then fix. The test must fail on unfixed code.

Pick the layer that would have caught it: unit for parse/domain, int for HTTP/db/worker, e2e only if the contract is the browser.

## Default

If unsure: unit. Then integration. E2e last.

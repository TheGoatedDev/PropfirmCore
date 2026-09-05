---
name: tech-stack
description: PropfirmCore stack. Use when adding deps, frontend, backend HTTP, validation, dates, routing, or state.
---

# Tech stack

Load this skill before adding a library or picking a tool. Tests: `.agents/skills/testing/SKILL.md`.

## Frontend

React, Vite, TanStack Router, TanStack Query, Zustand, nuqs, Tailwind.

- TanStack Query: server cache. Wrap the existing API client. Do not add another HTTP layer.
- Zustand: client UI state only.
- nuqs: URL search params. `NuqsAdapter` from `nuqs/adapters/tanstack-router` on the root route.

No: Next, React Router, Redux, SWR, Webpack, CRA.

## Backend

Hono, Drizzle, Better Auth.

No: NestJS, Express, Fastify, Prisma, TypeORM.

## Shared

Zod (validation), Luxon (time), Vitest (unit/integration), Biome (lint/format), Playwright (e2e), pnpm, turbo.

No: Yup, class-validator, Valibot, moment, dayjs, date-fns, Jest.

## Rules

Core libs only. Wrappers and adapters are not stack choices; use them if already in the repo.

Do not add a new core lib without asking.

---
name: tech-stack
description: PropfirmCore stack. Use when adding deps, frontend, backend HTTP, validation, dates, routing, state, or tests.
---

# Tech stack

Load this skill before adding a library or picking a tool.

## Frontend

React, Vite, TanStack Router, TanStack Query, Zustand, Tailwind, Vitest.

- TanStack Query: server cache. Wrap the existing API client. Do not add another HTTP layer.
- Zustand: client UI state only.

No: Next, React Router, Redux, SWR, Jest, Webpack, CRA.

## Backend

Hono, Drizzle, Better Auth.

No: NestJS, Express, Fastify, Prisma, TypeORM.

## Shared

Zod (validation), Luxon (time), Biome (lint/format), Playwright (e2e), pnpm, turbo.

No: Yup, class-validator, Valibot, moment, dayjs, date-fns.

## Rules

Core libs only. Wrappers and adapters are not stack choices; use them if already in the repo.

Do not add a new core lib without asking.

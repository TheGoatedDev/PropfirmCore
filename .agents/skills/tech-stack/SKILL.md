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
- React Hook Form + `@hookform/resolvers` (zod) for nested/complex forms. Pair with shadcn form fields in `@propfirmcore/ui`. Not for server cache.
- Page title is the breadcrumb (`staticData.crumb`). Do not add an `h1` (or equivalent) in the page body that repeats it.
- Do not nest `Card` or paper-like surfaces (e.g. `Alert`) inside each other.
- No Formik, Final Form, or extra form libs.

No: Next, React Router, Redux, SWR, Webpack, CRA.

## Backend

Hono, Drizzle, Better Auth, pino.

- pino-pretty when `NODE_ENV !== "production"`. Wrapper, not a stack pick.

No: NestJS, Express, Fastify, Prisma, TypeORM.

## Shared

Zod (validation), Luxon (time), Vitest (unit/integration), Biome (lint/format), Playwright (e2e), pnpm, turbo.

No: Yup, class-validator, Valibot, moment, dayjs, date-fns, Jest.

## Rules

Core libs only. Wrappers and adapters are not stack choices; use them if already in the repo.

Do not add a new core lib without asking.

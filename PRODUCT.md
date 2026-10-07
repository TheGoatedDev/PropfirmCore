# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

PropfirmCore is sold to prop trading firms. Each firm self-hosts one stack. It has two roles:

- **Trader**: buys a Product, trades a Trading account through the firm's Broker, and watches equity, warnings and payouts. They work at a desk, usually with the trading platform open on another screen and this app beside it as a status board.
- **Admin**: firm staff who configure the Firm (identity, brokers, products) and run day-to-day operations: completing payments, approving payouts, inspecting accounts, passing or failing books, verifying KYC and managing users. They also work at a desktop.

There is no Operator role. Custom roles are a later cut (ADR 0008, 0012).

## Product Purpose

PropfirmCore is a self-hosted engine for running a prop trading firm. The lifecycle is eval, then funded, then payout split. It fits a challenge mill or a retail prop firm. It sells Products with ordered Phases, enforces each Phase's Ruleset against broker snapshots and fills, and moves cash out through Payouts that an admin approves. Success means a firm runs its whole lifecycle on its own infrastructure.

## Positioning

The firm owns the stack and the data. There is one Firm per stack, on the firm's own infrastructure and its own Postgres. No vendor holds the books, the traders or the rule history. A SaaS prop-firm platform cannot truthfully claim this.

## Operating Context

- Deployment: one stack per firm. Caddy routes `/api` to the server, `/admin` to admin-web, and everything else to trader-web.
- The trader flow is sign up, then buy a Product with a Broker chosen at purchase (immutable, ADR 0005), then pay. The admin completes payment while checkout is `manual`. The account then becomes active, walks its Phases and requests payouts once funded.
- Broker data comes in through Ingest as snapshots and fills. A worker settles them and records breaches as Warnings (visible to the trader) or Flags (visible only to admins).
- Trading days end at the Firm's Daily close, a wall-clock time in the firm's timezone.
- Cash still leaves the firm by hand. A Payout's status only records the decision.

## Capabilities and Constraints

- Terminology is binding. See `CONTEXT.md` for the glossary and its "Avoid" lists. Use Firm (not tenant or brand), Product (not challenge or plan), Trading account (not account or challenge account), Funded (not live) and Sim (play money, not cash).
- Rules: targets and drawdowns are 0–1 fractions of start balance. Drawdown is static from start, not trailing (ADR 0009). Rule results are `pass`, `fail`, `continue`, `warn` and `flag`. A failed book is never reused.
- Bridges: `loopback` and `webhook` only. An MT5 adapter is a future target, and no platform-specific integration exists yet.
- Checkout: the `manual` adapter only. No card processor is integrated.
- Currency is a single firm-level setting. Times use Luxon and the firm timezone.
- Modules: `kyc` (gate on `payout` or `funded`), `affiliates`, and `multiBrand` (a flag only, unimplemented).
- Firm branding is undecided. PropfirmCore is meant to be white-labelled by each firm, but there is no firm logo, name or theme override in the UI yet. Today the apps are titled "Trader" and "Admin".
- Stack: React, Vite, TanStack Router and Query, Tailwind v4 and shadcn on `@base-ui/react`, all shared through `packages/ui`.

## Brand Commitments

- Traders see the firm's brand, not PropfirmCore. PropfirmCore stays invisible on trader-facing surfaces.
- Voice: terse, plain and operational. Examples: "Mark paid", "Resync ruleset", "KYC required". No marketing tone inside the apps.
- Page title comes from the breadcrumb (`staticData.crumb`). No main-content heading may repeat it. Cards never nest inside Cards.

## Evidence on Hand

- `CONTEXT.md` (glossary) and `docs/adr/0001`–`0013` (decisions).
- `packages/config/firm.example.json`: the example firm "Acme" with the "50k one-step" Product (fee $99, 50,000 balance, 6% target, 5% max drawdown, 2% daily drawdown, 4 min trading days, 80% payout split). This is sample data, not a customer.
- `e2e/smoke/challenge-flow.spec.ts`: the end-to-end buy-to-active flow.
- There are no customers, testimonials, logos, pricing for PropfirmCore itself, or benchmarks. Future work must not invent them.

## Product Principles

1. **The firm owns everything.** Never design in a dependency on a PropfirmCore-hosted service or vendor branding.
2. **The books are the truth.** Show the numbers that decide an account (equity, drawdown against start, warnings, breaches) exactly, and show where they came from.
3. **Admins operate, they don't browse.** Admin screens serve fast, correct decisions on payments, payouts and accounts.
4. **Traders get a status board.** The trader app answers "where does my account stand, and what can I do next?" at a glance beside a trading platform.
5. **Use one vocabulary.** UI copy uses the `CONTEXT.md` terms and never the "Avoid" words.

## Accessibility & Inclusion

No product-specific standard has been set. The baseline is WCAG 2.2 AA for both apps. Numbers and statuses must never rely on color alone, because pass/fail and warn/flag states carry money consequences.

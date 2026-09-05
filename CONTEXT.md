# PropfirmCore

Retail challenge mill: eval, then funded, then payout split. One firm per deploy.

## Language

### People

**Firm**:
The business that operates this mill. One Firm per deploy.
_Avoid_: tenant, organization, brand

**User**:
A login identity. May own many trading accounts, or none.

**Trader**:
A User who buys products, trades, and requests payouts.
_Avoid_: customer, client, account holder

**Admin**:
A User who operates the Firm: complete payments, force pass or fail, approve reject or pay payouts.

### Offering

**Product**:
A purchasable offering: ordered phases. Payout spec iff at least one phase is funded.
_Avoid_: challenge, plan, program

**Phase**:
One ordered stage of a Product. Kind is `eval` or `funded`. Own start balance and ruleset.

**Eval**:
Phase kind. Must pass its rules to advance. No payouts.

**Funded**:
Phase kind. Requires a payout spec on the Product. Payouts allowed while the trading account is active on this phase. Not a status.
_Avoid_: live, live account

**Fee**:
Cash price to open a trading account on a Product.
_Avoid_: subscription, tuition

**Ruleset**:
The numbers on a Phase: profit target, max drawdown, daily drawdown, min trading days.

**Rule**:
One check on a trading account against a ruleset. Result is `pass`, `fail`, or `continue`.
_Avoid_: constraint, metric, objective

**Profit target**:
Goal rule. Pass when equity minus start balance meets the number. Else continue.

**Max drawdown**:
Fail rule. Fail when start balance minus equity meets the number. From start balance, not peak.

**Daily drawdown**:
Fail rule. Fail when daily start equity minus equity meets the number.

**Min trading days**:
Goal rule. Pass when the book has at least that many trading days. Else continue.

### Book

**Trading account**:
A book that walks a Product's phases. Always owned by a User. Status is `active`, `passed`, or `failed`. A new paid Payment opens a new book; a failed book is not reused.
_Avoid_: Account, challenge account, reset, restart

**Active**:
Currently on a phase. Eval or funded.

**Passed**:
No phases left. Terminal.

**Failed**:
A fail rule fired, or an admin forced it. Terminal. Open payouts are not auto-rejected.

**Force pass**:
Admin sets status to `passed`. Skips rules.

**Force fail**:
Admin sets status to `failed`. Skips rules.

**Equity**:
Mark-to-market value of the book. Snapshot is truth.

**Sim**:
Play money on a trading account. Not cash.

**Balance**:
Sim cash on the book.

**Start balance**:
Size this phase opened with.

**Daily start equity**:
Equity when the current trading day began.

### Clock

**Daily close**:
Firm wall-clock that ends a trading day.

**Trading day**:
The day key the daily close assigns to a timestamp.

### Market

**Snapshot**:
Point-in-time book: equity, balance, positions.

**Fill**:
One execution. Counts toward trading days.
_Avoid_: tick, quote, order, trade

**Position**:
A lot on the book, open or closed.

**Instrument**:
A tradable spec: symbol, asset class, tick, multiplier, currency.

**Asset class**:
`fx`, `futures`, `crypto`, or `equity`.

**Ingest**:
Inbound feed of snapshots and fills onto an existing trading account. Unknown id is rejected. Does not open a book.
_Avoid_: webhook, stream

### Money in

**Payment**:
Money in for a Product. Status is `pending`, `paid`, `failed`, or `canceled`. `failed` = provider said no money. `canceled` = abandoned before money. A paid Payment opens a new trading account.
_Avoid_: Invoice, charge, order

### Money out

**Payout**:
Money out. An obligation to send the trader their share of funded sim profit. Cash still leaves the firm by hand.
_Avoid_: Withdrawal, profit split, disbursement

**Payout split**:
Trader share of sim profit, 0 to 1, on the product.

**Payout mode**:
When sim money moves. `debitOnApprove` is the only implemented mode. `freezeUntilPaid` and `debitOnPaid` are reserved names.
_Avoid_: Debit on request

**Pending**:
Trader requested a payout. Nothing deducted yet. The amount is reserved against available.

**Approved**:
Admin accepted the request. The bridge has withdrawn the amount from the trading account. Cash has not been sent.

**Rejected**:
Admin or policy denied the request. If it was already approved, the bridge deposits the amount back.
_Avoid_: Canceled, declined

**Paid**:
Admin marked the cash as sent outside the system. No sim change.
_Avoid_: Settled, completed

**Available**:
`(equity - startBalance) * split - sum(pending + approved)`.

**Uncoverable**:
Approve-time check when live available is less than the requested amount. Firm policy, optional product override: `failApprove` leaves it pending; `autoReject` sets `rejected` with reason `uncoverable`.

**Bridge**:
Outbound port that withdraws or deposits on the trading account. Loopback does it in this process. HTTP ingest is inbound snapshots and fills, not this.
_Avoid_: Broker adapter

**Loopback**:
The default bridge. Applies `applyPayout` here: equity, balance, and daily start move; rules do not run.

**HTTP adapter**:
Bridge with `provider: "webhook"`. POST `{ action, accountId, amount }` to `bridge.url`, then the same `applyPayout` as loopback. Optional `BRIDGE_WEBHOOK_KEY` as `X-Api-Key`.

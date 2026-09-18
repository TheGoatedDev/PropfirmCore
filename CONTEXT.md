# PropfirmCore

Eval, then funded, then payout split. Fits a challenge mill or a retail prop firm. One Firm per stack.

## Language

### People

**Firm**:
The business that sells products on this stack. One per stack.
_Avoid_: tenant, organization, brand, mill

**User**:
A login identity. May own many trading accounts, or none.

**Trader**:
A User who buys products, trades, and requests payouts.
_Avoid_: customer, client, account holder

**Admin**:
A User who operates the Firm: config, complete payments, force pass or fail, approve reject or pay payouts, set KYC.
_Avoid_: operator, superadmin

**KYC**:
The Firm's check that a User is verified. Off = no check.
_Avoid_: identity, verification, AML, onboarding

**KYC gate**:
When KYC is on: `payout` blocks sending cash; `funded` also blocks entering a funded phase.
_Avoid_: KYC mode, KYC stage

**Role**:
A permission set. Builtins are trader and admin. An Admin may add more.
_Avoid_: group, organization role, tenant role, operator

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
The checks on a Phase: profit target, max drawdown, daily drawdown, min trading days. Optional: consistency, weekend, max lot, max warnings.

**Rule**:
One check on a trading account against a ruleset. Result is `pass`, `fail`, `continue`, `warn`, or `flag`.
_Avoid_: constraint, metric, objective

**Profit target**:
Goal rule. Pass when (equity minus start balance) / start balance meets the fraction. Else continue.

**Max drawdown**:
Fail rule. Fail when (start balance minus equity) / start balance meets the fraction. From start balance, not peak.

**Daily drawdown**:
Fail rule. Fail when (daily start equity minus equity) / daily start equity meets the fraction.

**Min trading days**:
Goal rule. Pass when the book has at least that many trading days. Else continue.

**On breach**:
What an optional rule does when it fires: `fail`, `warn`, or `flag`. Not used on profit target, drawdowns, or min trading days.

**Warning**:
A recorded optional-rule breach. Trader-visible. Account stays active. Does not block pass. Counts toward max warnings.

**Flag**:
A recorded optional-rule breach. Admin-visible. Account stays active. Does not block pass. Does not count toward max warnings.

**Max warnings**:
Fail rule. Fail when this phase's warning count meets the number.

**Consistency**:
Optional rule. Best day's profit, or best trade's profit, over total profit, versus a threshold. Fires on breach.
_Avoid_: volume consistency

**Weekend**:
Optional rule. A fill whose time is Saturday or Sunday in the firm's daily close timezone.

**Max lot**:
Optional rule. An open position's quantity meets the number. Quantity is the snapshot qty, not a converted FX lot.

**Close position**:
Optional follow-on after a breach: the Broker is told to close that position, not the trading account. Loopback does nothing.

### Book

**Trading account**:
A book that walks a Product's phases. Always owned by a User. Status is `active`, `passed`, or `failed`. A new paid Payment opens a new book; a failed book is not reused. Holds the ruleset copied when this phase opened. Product edits do not change it unless an admin overwrites.
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
Inbound feed of snapshots and fills onto an existing trading account. Unknown id is rejected. Does not open a book. Key must match the account's Broker.
_Avoid_: webhook, stream

**Broker**:
The platform a trading account lives on. A Firm has many. A Product lists which. The trader picks at buy. Immutable after.
_Avoid_: platform, venue, Broker adapter

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
When sim money moves, and whether fills freeze while a payout is pending. `debitOnApprove` withdraws on approve. `freezeUntilApproved` also freezes fills until approve.
_Avoid_: Debit on request

**Frozen**:
Fills refused. Snapshots still settle. True while a `freezeUntilApproved` payout is pending. Not a trading-account status.

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
Outbound port on a Broker. Withdraw and deposit move sim. Freeze and unfreeze do not. Provision creates the remote book and returns login and password. Loopback does it in this process. HTTP ingest is inbound snapshots and fills, not this.
_Avoid_: Broker adapter

**Provision**:
Bridge action when a Payment completes. The Broker creates the remote book and returns login and password. Failure leaves the Payment pending and does not insert a trading account.

**Loopback**:
The default bridge. Applies `applyPayout` here: equity, balance, and daily start move; rules do not run. Freeze and unfreeze are no-ops. Provision returns login = account id, password = `loopback`.

**HTTP adapter**:
Bridge with `provider: "webhook"`. POST `{ action, accountId, amount? }` to the broker's `bridge.url`. `withdraw` and `deposit` then `applyPayout`. `freeze` and `unfreeze` do not move sim. `provision` returns `{ login, password }`. Optional per-broker `BRIDGE_WEBHOOK_KEY_<ID>` as `X-Api-Key`.

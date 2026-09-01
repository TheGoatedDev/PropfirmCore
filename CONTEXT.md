# PropfirmCore

Retail challenge mill: eval, then funded, then payout split. One firm per deploy.

## Language

**Trading account**:
A challenge or funded book that walks product phases. Status is `active`, `passed`, `failed`, or `funded`.
_Avoid_: Account, challenge account

**Payment**:
Money in. Checkout for a product. Status is `pending`, `paid`, `failed`, or `canceled`.
_Avoid_: Invoice, charge, order

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
_Avoid_: Broker adapter, webhook (the later HTTP adapter)

**Loopback**:
The default bridge. Applies `applyPayout` here: equity, balance, and daily start move; rules do not run.

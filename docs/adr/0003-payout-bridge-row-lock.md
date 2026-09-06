# Ingest waits on payout bridge via row lock, not a bus

A net snapshot can settle before `applyPayout` moves `dailyStartEquity`, so daily DD treats the withdraw as a loss. We considered a CQRS/command bus, NAK/skip snapshots, HTTP 409 on ingest, and a `bridging` status.

Approve and reject take `SELECT FOR UPDATE` on the payout then the trading account, call the bridge, then `applyPayout` in that same transaction. Ingest already locks the account, so it waits. Fills are not gated. Ingest HTTP stays 202. The lock is held for the bridge RTT (webhook timeout 5s); payouts are rare.

Rejected: outbound bus, ingest-await, dropping snapshots, request-reply over NATS.

# Ingest HTTP is a NATS producer; worker settles

Official bridges will flood fills and snapshots. We considered settling on the API thread forever, a sidecar that only HTTP-posts, BullMQ/Redis Streams, Kafka, and returning a stale account from ingest POST.

HTTP ingest stays the write port (`X-Api-Key`, same Snapshot / Fill bodies). It publishes to NATS JetStream and returns 202 `{ accountId, externalId }` (fills: `externalIds`). It does not run the engine. Worker consumes `ingest.snapshot` and `ingest.fills`, `SELECT FOR UPDATE` the trading account, applies existing `applySnapshot` / `applyFills` (idempotent `externalId`), acks after commit. Settled book is `GET`. Checkout, payouts, and force pass/fail stay sync. Outbound live UI is a later, separate path.

Rejected: ticks (market-data platform), one `kind` subject, per-account subjects, 200-wait, dual sync+bus write paths, two brokers, domain events / event sourcing for the book.

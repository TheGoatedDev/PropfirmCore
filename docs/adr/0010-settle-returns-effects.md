# Settle returns breaches and closes; the worker performs I/O

Optional rules can warn, flag, and ask the broker to close a position. The domain engine stays pure: `settle` returns `{ account, breaches, closes }`.

The ingest worker persists breach rows, then calls `bridge.close`. Loopback close is a no-op. A local close without the broker would come back on the next snapshot.

Rejected: I/O inside `evaluate`, treating warn/flag as `continue` (that blocks phase pass forever).

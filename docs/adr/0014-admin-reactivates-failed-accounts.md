# Admins can reactivate a failed account; a passed account cannot be failed

Failed was terminal. Firms need to undo a wrong fail (a bad snapshot, a mistaken force fail) without selling a new book. An admin may now reactivate a `failed` account: status returns to `active` on the same phase, book and ruleset. Nothing else is reset, so an account still below a drawdown floor fails again on the next settle.

Force fail now needs an `active` account. Passed is final: failing it would take back a result the trader earned. The API answers 409 for either wrong state, and `tradingAccount:reactivate` is an admin permission.

Rejected: resetting equity or the trading day on reactivate (that is a new book, which a Payment buys), allowing reactivate on passed accounts.

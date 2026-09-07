# Freeze is refuse fills plus a bridge webhook, not a status

`freezeUntilApproved` disables trading while a payout is pending. We considered a `frozen` account status, rejecting snapshots, and an outbound-only broker lock.

Approve still withdraws on every mode. Freeze is `POST { action: "freeze" }` on the webhook bridge (loopback no-op) and HTTP 409 on ingest fills. Snapshots still settle. Unfreeze on approve or reject. Trading-account status stays `active | passed | failed`.

Rejected: new status, freeze until paid, snapshot 409.


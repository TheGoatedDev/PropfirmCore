# Payouts debit on admin approve via a bridge

A payout is a record, not a bank transfer. We considered debiting on request, keeping an effective-equity column next to snapshots, or treating snapshots as already net of withdrawals.

We debit when an admin approves, through a bridge port. Loopback applies `applyPayout` in this process and does not run challenge rules. Later adapters can POST withdraw/deposit to a real bridge; ingest snapshots stay the inbound truth and must come in net after a withdraw. Paid is only a flag that cash left the firm by hand.

Pending reserves available so two requests cannot claim the same profit. If equity has dropped by approve time, firm `onUncoverable` either fails the approve or auto-rejects with reason `uncoverable`. Reject after approve deposits back.

Rejected alternatives: effective equity (double-counts a honest bridge), debit on request (no admin gate), debit on mark-paid (cash and sim coupled).

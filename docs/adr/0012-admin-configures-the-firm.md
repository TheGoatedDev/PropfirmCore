# Admin configures the Firm

One Firm, two roles: trader and admin. Admin-web owns config (identity, brokers, products) and day-to-day ops. No Operator role, no operator-web. Books and config rows do not carry a firm id; they belong to the singleton Firm.

Rejected: Operator as stack-level actor, `firm_id` on child tables, Host routing. Supersedes the Operator bits of ADR 0008 and 0011.

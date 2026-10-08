---
status: superseded in part by ADR-0012 and ADR-0015
---

# Firm staff roles belong to a Firm

Custom roles (support, auditor) are a per-Firm catalog, not Operator, not a global table. Builtins `operator`, `trader`, and `admin` stay in code. Custom names never go in Better Auth `adminRoles` — that plugin is unscoped and boot-static. Lookup later is `(firm_id, name)` after builtins. CRUD is a later cut.

Rejected: global role table, organization-plugin roles, custom roles on `/auth/admin/*`.

Update (ADR-0015): one Firm per stack, so custom Roles are keyed by `name` alone, and CRUD is in. The Better Auth admin plugin and `adminRoles` are gone.

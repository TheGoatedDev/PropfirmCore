---
status: superseded in part by ADR-0012
---

# Firm staff roles belong to a Firm

Custom roles (support, auditor) are a per-Firm catalog, not Operator, not a global table. Builtins `operator`, `trader`, and `admin` stay in code. Custom names never go in Better Auth `adminRoles` — that plugin is unscoped and boot-static. Lookup later is `(firm_id, name)` after builtins. CRUD is a later cut.

Rejected: global role table, organization-plugin roles, custom roles on `/auth/admin/*`.

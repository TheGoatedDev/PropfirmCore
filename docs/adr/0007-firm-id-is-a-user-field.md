---
status: superseded by ADR-0011
---

# Firm id is a user field, not an organization plugin

Better Auth’s organization plugin is membership: `activeOrganizationId`, invitations, global email as one login across many Firms. We are one User to one Firm. `user.firmId` is an additionalField (`input: false`), stamped on create from the live Firm. Operator then has `firmId` null. Admin plugin stays; `adminRoles` are `admin` and `operator`. Those admin APIs are unscoped — fine while one live Firm.

Rejected: organization plugin, per-firm unique email this cut.

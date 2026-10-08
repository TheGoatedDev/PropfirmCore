# We own access control; Better Auth only authenticates

Custom Roles need Permissions that live in Postgres and change at runtime. The Better Auth admin plugin fixes its roles at boot, re-checks callers against them (so a custom Role holding `user:create` was refused), and serves `/auth/admin/*` routes that bypass our checks. We already ran every Hono route through our own `roleHasPermission`, so the plugin was a second, weaker copy.

The admin plugin is gone. A small `firmAccess` Better Auth plugin keeps only lifecycle work: the `role` and `banned` user fields, the default Role on sign-up, and refusing sign-in to a banned User. It has no endpoints. Roles, Permissions, and User management are ours: a Permission catalog in code, builtin `trader` (nothing) and `admin` (everything) fixed in code, custom Roles in a `firm_role` table keyed by name, and Hono routes for all of it. Each User has exactly one Role. Staff can grant only Permissions they hold, can act only on Users and Roles within their own (before and after any edit), and can never act on themselves or their own Role. A ban or Role change that would leave no unbanned Admin is refused; if the database gets there anyway, boot with `BOOTSTRAP_ADMIN_EMAIL` restores one.

All of it lives in `@propfirmcore/access`. The root entry is pure (Permission list, builtins, checks) so admin-web can share it. The `/server` entry holds the plugin, the Role table, the Role cache, and Role CRUD.

Rejected: keeping the admin plugin and mirroring custom Roles into it, moving to the organization plugin, putting Role and User endpoints inside our plugin, multiple Roles per User, editable builtins, impersonation and timed bans. Supersedes the RBAC part of ADR 0008 and the "two roles" part of ADR 0012.

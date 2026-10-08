import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import {
    type Action,
    cleanPermissions,
    hasPermission,
    type Permissions,
    permissionsOf,
    type Resource,
} from "../index.ts";
import { firmRoles } from "./schema.ts";

// biome-ignore lint/suspicious/noExplicitAny: any schema; we only touch firm_role.
export type AccessDb = PgDatabase<PgQueryResultHKT, any>;

// One cache per process; the server reloads it on NOTIFY firm_roles.
let customRoles: ReadonlyMap<string, Permissions> = new Map();

export function setRoles(roles: ReadonlyMap<string, Permissions>): void {
    customRoles = roles;
}

let loadsStarted = 0;
let loadApplied = 0;

/** Reloads can overlap; one that started earlier never overwrites a later one. */
export async function loadRoles(db: AccessDb): Promise<void> {
    const seq = ++loadsStarted;
    const rows = await db.select().from(firmRoles);
    if (seq < loadApplied) return;
    loadApplied = seq;
    setRoles(
        new Map(rows.map((r) => [r.name, cleanPermissions(r.permissions)])),
    );
}

export function customRoleNames(): string[] {
    return [...customRoles.keys()];
}

export function permissionsFor(role: string): Permissions {
    return permissionsOf(role, customRoles);
}

export function roleHasPermission<R extends Resource>(
    role: string,
    resource: R,
    action: Action<R>,
): boolean {
    return hasPermission(permissionsFor(role), resource, action);
}

export { BANNED_USER, createStaffUser, firmAccess } from "./firm-access.ts";
export {
    type Actor,
    createRole,
    deleteRole,
    listRoles,
    type RoleOut,
    updateRole,
} from "./roles.ts";
export { firmRoles } from "./schema.ts";

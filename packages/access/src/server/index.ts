import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import {
    cleanPermissions,
    hasPermission,
    type Permissions,
    permissionsOf,
} from "../index.ts";
import { firmRoles } from "./schema.ts";

// biome-ignore lint/suspicious/noExplicitAny: any schema; we only touch firm_role.
export type AccessDb = PgDatabase<PgQueryResultHKT, any>;

// One cache per process; the server reloads it on NOTIFY firm_roles.
let customRoles: ReadonlyMap<string, Permissions> = new Map();

export function setRoles(roles: ReadonlyMap<string, Permissions>): void {
    customRoles = roles;
}

export async function loadRoles(db: AccessDb): Promise<void> {
    const rows = await db.select().from(firmRoles);
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

export function roleHasPermission(
    role: string,
    resource: string,
    action: string,
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

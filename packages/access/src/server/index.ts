import { hasPermission, type Permissions, permissionsOf } from "../index.ts";

// One cache per process; the server reloads it on NOTIFY firm_roles.
let customRoles: ReadonlyMap<string, Permissions> = new Map();

export function setRoles(roles: ReadonlyMap<string, Permissions>): void {
    customRoles = roles;
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

import { isBuiltinRole, within } from "@propfirmcore/access";
import {
    type Actor,
    customRoleNames,
    permissionsFor,
    roleHasPermission,
} from "@propfirmcore/access/server";

export type UserRow = {
    id: string;
    email: string;
    name: string;
    role: string;
    banned: boolean;
    createdAt: Date;
};

export type ListScope = "all" | "none";

export function userOut(row: UserRow) {
    return {
        id: row.id,
        email: row.email,
        name: row.name,
        role: row.role,
        banned: row.banned,
        createdAt: row.createdAt.toISOString(),
    };
}

export function listScope(who: Actor): ListScope {
    return roleHasPermission(who.role, "user", "list") ? "all" : "none";
}

function knownRole(role: string): boolean {
    return isBuiltinRole(role) || customRoleNames().includes(role);
}

/** The Role's Permissions are all held by the actor. Peers pass. */
function reaches(who: Actor, role: string): boolean {
    return within(permissionsFor(role), permissionsFor(who.role));
}

export function createPlan(
    who: Actor,
    input: { role: string },
): { ok: true } | { ok: false; error: "forbidden" | "badRequest" } {
    if (!roleHasPermission(who.role, "user", "create")) {
        return { ok: false, error: "forbidden" };
    }
    if (!knownRole(input.role)) return { ok: false, error: "badRequest" };
    if (!reaches(who, input.role)) return { ok: false, error: "forbidden" };
    return { ok: true };
}

export function banPlan(
    who: Actor,
    target: UserRow | undefined,
): { ok: true } | { ok: false; error: "forbidden" | "notFound" } {
    if (!roleHasPermission(who.role, "user", "ban")) {
        return { ok: false, error: "forbidden" };
    }
    if (!target) return { ok: false, error: "notFound" };
    if (who.id === target.id) return { ok: false, error: "forbidden" };
    if (!reaches(who, target.role)) return { ok: false, error: "forbidden" };
    return { ok: true };
}

export function setRolePlan(
    who: Actor,
    target: UserRow | undefined,
    role: string,
):
    | { ok: true }
    | { ok: false; error: "forbidden" | "notFound" | "badRequest" } {
    if (!roleHasPermission(who.role, "user", "set-role")) {
        return { ok: false, error: "forbidden" };
    }
    if (!target) return { ok: false, error: "notFound" };
    if (who.id === target.id) return { ok: false, error: "forbidden" };
    if (!knownRole(role)) return { ok: false, error: "badRequest" };
    if (!reaches(who, target.role) || !reaches(who, role)) {
        return { ok: false, error: "forbidden" };
    }
    return { ok: true };
}

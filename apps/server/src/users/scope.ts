import { roleHasPermission } from "../auth/permissions.ts";

export const firmRoles = ["trader", "admin"] as const;

export type FirmRole = (typeof firmRoles)[number];

export type Actor = { id: string; role: string };

export type UserRow = {
    id: string;
    email: string;
    name: string;
    role: string | null;
    banned: boolean | null;
    createdAt: Date;
};

export type ListScope = "all" | "none";

export function roleOut(role: string | null | undefined): FirmRole | null {
    return role === "trader" || role === "admin" ? role : null;
}

export function userOut(row: UserRow) {
    return {
        id: row.id,
        email: row.email,
        name: row.name,
        role: roleOut(row.role),
        banned: row.banned ?? false,
        createdAt: row.createdAt.toISOString(),
    };
}

export function listScope(who: Actor): ListScope {
    return roleHasPermission(who.role, "user", "list") ? "all" : "none";
}

export function canTouch(who: Actor, _target: { id: string }): boolean {
    return listScope(who) !== "none";
}

export function createPlan(
    who: Actor,
    input: { role?: FirmRole },
):
    | { ok: true; role: FirmRole }
    | { ok: false; error: "forbidden" | "badRequest" } {
    if (!roleHasPermission(who.role, "user", "create")) {
        return { ok: false, error: "forbidden" };
    }
    if (input.role !== "trader" && input.role !== "admin") {
        return { ok: false, error: "badRequest" };
    }
    return { ok: true, role: input.role };
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
    if (!canTouch(who, target)) return { ok: false, error: "notFound" };
    return { ok: true };
}

export function setRolePlan(
    who: Actor,
    target: UserRow | undefined,
    role: FirmRole,
):
    | { ok: true }
    | { ok: false; error: "forbidden" | "notFound" | "badRequest" } {
    if (!roleHasPermission(who.role, "user", "set-role")) {
        return { ok: false, error: "forbidden" };
    }
    if (!target) return { ok: false, error: "notFound" };
    if (who.id === target.id) return { ok: false, error: "forbidden" };
    if (!canTouch(who, target)) return { ok: false, error: "notFound" };
    if (role !== "trader" && role !== "admin") {
        return { ok: false, error: "badRequest" };
    }
    return { ok: true };
}

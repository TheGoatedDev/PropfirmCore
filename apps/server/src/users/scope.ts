import { roleHasPermission } from "../auth/permissions.ts";

export const userKinds = ["operator", "firmUser"] as const;
export const firmRoles = ["trader", "admin"] as const;

export type UserKind = (typeof userKinds)[number];
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

export type ListScope = "all" | "firm" | "none";

export function kindOf(role: string | null | undefined): UserKind {
    return role === "operator" ? "operator" : "firmUser";
}

export function roleOut(role: string | null | undefined): FirmRole | null {
    return role === "trader" || role === "admin" ? role : null;
}

export function userOut(row: UserRow) {
    return {
        id: row.id,
        email: row.email,
        name: row.name,
        kind: kindOf(row.role),
        role: roleOut(row.role),
        banned: row.banned ?? false,
        createdAt: row.createdAt.toISOString(),
    };
}

export function listScope(who: Actor): ListScope {
    if (!roleHasPermission(who.role, "user", "list")) return "none";
    return who.role === "operator" ? "all" : "firm";
}

export function canTouch(
    who: Actor,
    target: { id: string; role: string | null },
): boolean {
    const scope = listScope(who);
    if (scope === "none") return false;
    if (scope === "firm" && kindOf(target.role) === "operator") return false;
    return true;
}

export function createPlan(
    who: Actor,
    input: { kind: UserKind; role?: FirmRole },
):
    | { ok: true; role: "operator" | FirmRole }
    | { ok: false; error: "forbidden" | "badRequest" } {
    if (!roleHasPermission(who.role, "user", "create")) {
        return { ok: false, error: "forbidden" };
    }
    if (input.kind === "operator") {
        if (who.role !== "operator") return { ok: false, error: "forbidden" };
        return { ok: true, role: "operator" };
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
    if (kindOf(target.role) === "operator") {
        return { ok: false, error: "forbidden" };
    }
    if (role !== "trader" && role !== "admin") {
        return { ok: false, error: "badRequest" };
    }
    return { ok: true };
}

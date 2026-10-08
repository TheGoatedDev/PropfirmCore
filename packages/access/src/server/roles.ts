import type { AuthContext } from "better-auth";
import { eq, sql } from "drizzle-orm";
import {
    builtinRoles,
    cleanPermissions,
    isBuiltinRole,
    isStaff,
    type Permissions,
    within,
} from "../index.ts";
import {
    type AccessDb,
    loadRoles,
    permissionsFor,
    roleHasPermission,
} from "./index.ts";
import { firmRoles } from "./schema.ts";

export type Actor = { id: string; role: string };

export type RoleOut = {
    name: string;
    builtin: boolean;
    permissions: Permissions;
    userCount: number;
};

// Only what we call: the full AuthContext is generic over the auth options.
export type HasAdapter = {
    $context: Promise<{ adapter: Pick<AuthContext["adapter"], "count"> }>;
};

type Denied = { status: "forbidden" } | { status: "notFound" };

async function holders(auth: HasAdapter, name: string): Promise<number> {
    const { adapter } = await auth.$context;
    return adapter.count({
        model: "user",
        where: [{ field: "role", value: name }],
    });
}

// Commit, then reload this process now; other replicas reload on NOTIFY.
async function write(
    db: AccessDb,
    change: (tx: AccessDb) => Promise<unknown>,
): Promise<void> {
    await db.transaction(async (tx) => {
        await change(tx);
        await tx.execute(sql`select pg_notify('firm_roles', '')`);
    });
    await loadRoles(db);
}

async function rowOf(db: AccessDb, name: string) {
    const rows = await db
        .select()
        .from(firmRoles)
        .where(eq(firmRoles.name, name))
        .limit(1);
    return rows[0];
}

/** Gate for edit and delete: Role exists, is custom, not yours, within yours. */
async function editable(
    db: AccessDb,
    who: Actor,
    name: string,
): Promise<{ ok: true; permissions: Permissions } | Denied> {
    if (!roleHasPermission(who.role, "role", "write")) {
        return { status: "forbidden" };
    }
    if (isBuiltinRole(name) || name === who.role) {
        return { status: "forbidden" };
    }
    const row = await rowOf(db, name);
    if (!row) return { status: "notFound" };
    const permissions = cleanPermissions(row.permissions);
    if (!within(permissions, permissionsFor(who.role))) {
        return { status: "forbidden" };
    }
    return { ok: true, permissions };
}

export async function listRoles(
    db: AccessDb,
    auth: HasAdapter,
    who: Actor,
): Promise<{ status: "ok"; roles: RoleOut[] } | { status: "forbidden" }> {
    if (!isStaff(permissionsFor(who.role))) return { status: "forbidden" };
    const rows = await db.select().from(firmRoles).orderBy(firmRoles.name);
    const all = [
        ...Object.entries(builtinRoles).map(([name, permissions]) => ({
            name,
            builtin: true,
            permissions: permissions as Permissions,
        })),
        ...rows.map((r) => ({
            name: r.name,
            builtin: false,
            permissions: cleanPermissions(r.permissions),
        })),
    ];
    const roles = await Promise.all(
        all.map(async (r) => ({
            ...r,
            userCount: await holders(auth, r.name),
        })),
    );
    return { status: "ok", roles };
}

export async function createRole(
    db: AccessDb,
    who: Actor,
    input: { name: string; permissions: Permissions },
): Promise<
    | { status: "ok"; role: RoleOut }
    | { status: "forbidden" }
    | { status: "exists" }
> {
    if (!roleHasPermission(who.role, "role", "write")) {
        return { status: "forbidden" };
    }
    if (isBuiltinRole(input.name)) return { status: "exists" };
    const permissions = cleanPermissions(input.permissions);
    if (!within(permissions, permissionsFor(who.role))) {
        return { status: "forbidden" };
    }
    let inserted = false;
    await write(db, async (tx) => {
        const rows = await tx
            .insert(firmRoles)
            .values({ name: input.name, permissions })
            .onConflictDoNothing()
            .returning({ name: firmRoles.name });
        inserted = rows.length > 0;
    });
    if (!inserted) return { status: "exists" };
    return {
        status: "ok",
        role: { name: input.name, builtin: false, permissions, userCount: 0 },
    };
}

export async function updateRole(
    db: AccessDb,
    auth: HasAdapter,
    who: Actor,
    name: string,
    input: { permissions: Permissions },
): Promise<{ status: "ok"; role: RoleOut } | Denied> {
    const gate = await editable(db, who, name);
    if (!("ok" in gate)) return gate;
    const permissions = cleanPermissions(input.permissions);
    if (!within(permissions, permissionsFor(who.role))) {
        return { status: "forbidden" };
    }
    await write(db, (tx) =>
        tx
            .update(firmRoles)
            .set({ permissions })
            .where(eq(firmRoles.name, name)),
    );
    return {
        status: "ok",
        role: {
            name,
            builtin: false,
            permissions,
            userCount: await holders(auth, name),
        },
    };
}

/** Refuses while any User holds the Role. A racing set-role can still land on
 * a deleted Role; that User then has no Permissions until reassigned. */
export async function deleteRole(
    db: AccessDb,
    auth: HasAdapter,
    who: Actor,
    name: string,
): Promise<{ status: "ok" } | { status: "inUse" } | Denied> {
    const gate = await editable(db, who, name);
    if (!("ok" in gate)) return gate;
    if ((await holders(auth, name)) > 0) return { status: "inUse" };
    await write(db, (tx) =>
        tx.delete(firmRoles).where(eq(firmRoles.name, name)),
    );
    return { status: "ok" };
}

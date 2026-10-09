import { type Actor, createStaffUser } from "@propfirmcore/access/server";
import { and, asc, count, desc, eq, ilike, ne, or, sql } from "drizzle-orm";
import type { Auth } from "../auth/auth.ts";
import { session, user } from "../auth/auth-schema.ts";
import type { Db } from "../db/db.ts";
import {
    banPlan,
    createPlan,
    listScope,
    setRolePlan,
    userOut,
} from "./scope.ts";

const sortColumns = {
    email: user.email,
    createdAt: user.createdAt,
} as const;

export type UserListSort = keyof typeof sortColumns;

export async function listUsers(
    db: Db,
    input: {
        who: Actor;
        page: number;
        pageSize: number;
        q?: string;
        sort?: UserListSort;
        order: "asc" | "desc";
        role?: string;
        banned?: boolean;
    },
): Promise<{ items: ReturnType<typeof userOut>[]; total: number }> {
    const scope = listScope(input.who);
    if (scope === "none") return { items: [], total: 0 };

    const parts = [];
    const q = input.q?.trim();
    if (q) {
        const pattern = `%${q}%`;
        parts.push(
            or(
                ilike(user.email, pattern),
                ilike(user.name, pattern),
                ilike(user.id, pattern),
            ),
        );
    }
    if (input.role) parts.push(eq(user.role, input.role));
    if (input.banned === true) parts.push(eq(user.banned, true));
    if (input.banned === false) {
        parts.push(eq(user.banned, false));
    }
    const where = parts.length ? and(...parts) : undefined;
    const col = sortColumns[input.sort ?? "createdAt"];
    const order = input.order === "asc" ? asc(col) : desc(col);
    const [rows, totals] = await Promise.all([
        db
            .select()
            .from(user)
            .where(where)
            .orderBy(order)
            .limit(input.pageSize)
            .offset((input.page - 1) * input.pageSize),
        db.select({ n: count() }).from(user).where(where),
    ]);
    return {
        items: rows.map(userOut),
        total: totals[0]?.n ?? 0,
    };
}

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

async function byId(db: Db | Tx, id: string) {
    const rows = await db.select().from(user).where(eq(user.id, id)).limit(1);
    return rows[0];
}

/**
 * Serialize ban and Role changes, then check an unbanned Admin other than
 * `id` survives. Two Staff banning each other's Admins at once would
 * otherwise both see the other still standing.
 */
async function anotherAdmin(tx: Tx, id: string): Promise<boolean> {
    const rows = await tx
        .select({ id: user.id })
        .from(user)
        .where(
            and(
                eq(user.role, "admin"),
                eq(user.banned, false),
                ne(user.id, id),
            ),
        )
        .limit(1);
    return rows.length > 0;
}

async function lockUserAdmin(tx: Tx): Promise<void> {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('user-admin'))`);
}

export async function createListedUser(
    db: Db,
    auth: Auth,
    who: Actor,
    input: {
        email: string;
        name: string;
        password: string;
        role: string;
    },
): Promise<
    | { status: "ok"; user: ReturnType<typeof userOut> }
    | { status: "forbidden" }
    | { status: "badRequest" }
    | { status: "exists" }
> {
    const plan = createPlan(who, input);
    if (!plan.ok) return { status: plan.error };
    const created = await createStaffUser(auth, {
        email: input.email,
        password: input.password,
        name: input.name,
        role: input.role,
    });
    if (!created) return { status: "exists" };
    const row = await byId(db, created.id);
    if (!row) return { status: "badRequest" };
    return { status: "ok", user: userOut(row) };
}

export async function setUserBanned(
    db: Db,
    who: Actor,
    id: string,
    banned: boolean,
): Promise<
    | { status: "ok"; user: ReturnType<typeof userOut> }
    | { status: "forbidden" }
    | { status: "notFound" }
    | { status: "lastAdmin" }
> {
    return db.transaction(async (tx) => {
        await lockUserAdmin(tx);
        const target = await byId(tx, id);
        const plan = banPlan(who, target);
        if (!plan.ok) return { status: plan.error };
        if (
            banned &&
            target?.role === "admin" &&
            !(await anotherAdmin(tx, id))
        ) {
            return { status: "lastAdmin" };
        }
        await tx.update(user).set({ banned }).where(eq(user.id, id));
        if (banned) {
            await tx.delete(session).where(eq(session.userId, id));
        }
        const row = await byId(tx, id);
        if (!row) return { status: "notFound" };
        return { status: "ok", user: userOut(row) };
    });
}

export async function setUserRole(
    db: Db,
    who: Actor,
    id: string,
    role: string,
): Promise<
    | { status: "ok"; user: ReturnType<typeof userOut> }
    | { status: "forbidden" }
    | { status: "notFound" }
    | { status: "badRequest" }
    | { status: "lastAdmin" }
> {
    return db.transaction(async (tx) => {
        await lockUserAdmin(tx);
        const target = await byId(tx, id);
        const plan = setRolePlan(who, target, role);
        if (!plan.ok) return { status: plan.error };
        if (
            target?.role === "admin" &&
            role !== "admin" &&
            !(await anotherAdmin(tx, id))
        ) {
            return { status: "lastAdmin" };
        }
        await tx.update(user).set({ role }).where(eq(user.id, id));
        const row = await byId(tx, id);
        if (!row) return { status: "notFound" };
        return { status: "ok", user: userOut(row) };
    });
}

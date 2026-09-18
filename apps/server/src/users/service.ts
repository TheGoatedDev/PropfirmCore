import { and, asc, count, desc, eq, ilike, isNull, or } from "drizzle-orm";
import type { Auth } from "../auth/auth.ts";
import { session, user } from "../auth/auth-schema.ts";
import type { Db } from "../db/db.ts";
import {
    type Actor,
    banPlan,
    createPlan,
    type FirmRole,
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
        role?: FirmRole;
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
        parts.push(or(eq(user.banned, false), isNull(user.banned)));
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

async function byId(db: Db, id: string) {
    const rows = await db.select().from(user).where(eq(user.id, id)).limit(1);
    return rows[0];
}

export async function createListedUser(
    db: Db,
    auth: Auth,
    headers: Headers,
    who: Actor,
    input: {
        email: string;
        name: string;
        password: string;
        role: FirmRole;
    },
): Promise<
    | { status: "ok"; user: ReturnType<typeof userOut> }
    | { status: "forbidden" }
    | { status: "badRequest" }
    | { status: "exists" }
> {
    const plan = createPlan(who, input);
    if (!plan.ok) return { status: plan.error };
    const dup = await db
        .select({ id: user.id })
        .from(user)
        .where(eq(user.email, input.email))
        .limit(1);
    if (dup[0]) return { status: "exists" };
    try {
        const created = await auth.api.createUser({
            body: {
                email: input.email,
                password: input.password,
                name: input.name,
                role: plan.role,
            },
            headers,
        });
        const id = created.user.id;
        const row = await byId(db, id);
        if (!row) return { status: "badRequest" };
        return { status: "ok", user: userOut(row) };
    } catch {
        return { status: "exists" };
    }
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
> {
    const target = await byId(db, id);
    const plan = banPlan(who, target);
    if (!plan.ok) return { status: plan.error };
    await db
        .update(user)
        .set({ banned, banReason: null, banExpires: null })
        .where(eq(user.id, id));
    if (banned) {
        await db.delete(session).where(eq(session.userId, id));
    }
    const row = await byId(db, id);
    if (!row) return { status: "notFound" };
    return { status: "ok", user: userOut(row) };
}

export async function setUserRole(
    db: Db,
    who: Actor,
    id: string,
    role: FirmRole,
): Promise<
    | { status: "ok"; user: ReturnType<typeof userOut> }
    | { status: "forbidden" }
    | { status: "notFound" }
    | { status: "badRequest" }
> {
    const target = await byId(db, id);
    const plan = setRolePlan(who, target, role);
    if (!plan.ok) return { status: plan.error };
    await db.update(user).set({ role }).where(eq(user.id, id));
    const row = await byId(db, id);
    if (!row) return { status: "notFound" };
    return { status: "ok", user: userOut(row) };
}

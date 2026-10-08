import { and, eq } from "drizzle-orm";
import { afterAll, expect, inject, it } from "vitest";
import { createDb } from "../db/db.ts";
import { createAuth } from "./auth.ts";
import { user } from "./auth-schema.ts";
import { bootstrapAdmin } from "./bootstrap-admin.ts";

const base = "http://localhost:3000";
const { db, sql } = createDb(inject("databaseUrl"));

afterAll(() => sql.end());

function cookie(res: Response): string {
    return res.headers
        .getSetCookie()
        .map((c) => c.split(";")[0])
        .join("; ");
}

async function post(
    path: string,
    body: unknown,
    headers: Record<string, string> = {},
): Promise<Response> {
    return fetch(`${base}${path}`, {
        method: "POST",
        headers: {
            origin: base,
            "content-type": "application/json",
            ...headers,
        },
        body: JSON.stringify(body),
    });
}

async function signIn(email: string, password: string) {
    return post("/auth/sign-in/email", { email, password });
}

async function me(session: string) {
    const res = await fetch(`${base}/auth/me`, {
        headers: { origin: base, cookie: session },
    });
    return (await res.json()) as { id: string; role: string };
}

it("serves no Better Auth admin routes", async () => {
    const admin = cookie(await signIn("admin@example.com", "changeme"));
    const res = await fetch(`${base}/auth/admin/list-users`, {
        headers: { origin: base, cookie: admin },
    });
    expect(res.status).toBe(404);
});

it("sign-up cannot pick a Role", async () => {
    const email = `self${Date.now()}@example.com`;
    const res = await post("/auth/sign-up/email", {
        name: "Self",
        email,
        password: "password12",
        role: "admin",
    });
    if (res.ok) {
        expect((await me(cookie(res))).role).toBe("trader");
    } else {
        expect(res.status).toBe(400);
    }
});

it("staff-created users sign in; banned users cannot", async () => {
    const admin = cookie(await signIn("admin@example.com", "changeme"));
    const email = `staff${Date.now()}@example.com`;
    const created = await post(
        "/users",
        { email, name: "Staff", password: "password12", role: "admin" },
        { cookie: admin },
    );
    expect(created.ok).toBe(true);
    const { id } = (await created.json()) as { id: string };

    const first = await signIn(email, "password12");
    expect(first.ok).toBe(true);
    expect((await me(cookie(first))).role).toBe("admin");

    const ban = await post(
        `/users/${id}/ban`,
        { banned: true },
        { cookie: admin },
    );
    expect(ban.ok).toBe(true);

    const refused = await signIn(email, "password12");
    expect(refused.status).toBe(403);
    expect(((await refused.json()) as { code: string }).code).toBe(
        "BANNED_USER",
    );
});

it("bootstrap restores an Admin when none is unbanned", async () => {
    const auth = createAuth(db, {
        secret: "change-me-to-a-long-random-string",
        baseURL: base,
    });
    const before = await db
        .select({ id: user.id })
        .from(user)
        .where(and(eq(user.role, "admin"), eq(user.banned, false)));
    await db.update(user).set({ banned: true }).where(eq(user.role, "admin"));

    await bootstrapAdmin(db, auth, {
        email: "admin@example.com",
        password: "changeme",
    });

    const [row] = await db
        .select({ role: user.role, banned: user.banned })
        .from(user)
        .where(eq(user.email, "admin@example.com"));
    expect(row).toEqual({ role: "admin", banned: false });
    expect((await signIn("admin@example.com", "changeme")).ok).toBe(true);

    for (const { id } of before) {
        await db.update(user).set({ banned: false }).where(eq(user.id, id));
    }
});

it("bootstrap never promotes a non-Admin who owns the email", async () => {
    const auth = createAuth(db, {
        secret: "change-me-to-a-long-random-string",
        baseURL: base,
    });
    const squatter = `squat${Date.now()}@example.com`;
    expect(
        (
            await post("/auth/sign-up/email", {
                name: "Squatter",
                email: squatter,
                password: "password12",
            })
        ).ok,
    ).toBe(true);
    const before = await db
        .select({ id: user.id })
        .from(user)
        .where(and(eq(user.role, "admin"), eq(user.banned, false)));
    await db.update(user).set({ banned: true }).where(eq(user.role, "admin"));

    try {
        await expect(
            bootstrapAdmin(db, auth, { email: squatter, password: "x" }),
        ).rejects.toThrow();
        const [row] = await db
            .select({ role: user.role })
            .from(user)
            .where(eq(user.email, squatter));
        expect(row?.role).toBe("trader");
    } finally {
        for (const { id } of before) {
            await db.update(user).set({ banned: false }).where(eq(user.id, id));
        }
    }
});

it("/auth/me lists the caller's Permissions", async () => {
    const admin = cookie(await signIn("admin@example.com", "changeme"));
    const adminMe = (await (
        await fetch(`${base}/auth/me`, {
            headers: { origin: base, cookie: admin },
        })
    ).json()) as { permissions: Record<string, string[]> };
    expect(adminMe.permissions.firm).toEqual(["read", "write"]);

    const res = await post("/auth/sign-up/email", {
        name: "Plain",
        email: `plain${Date.now()}@example.com`,
        password: "password12",
    });
    const traderMe = (await (
        await fetch(`${base}/auth/me`, {
            headers: { origin: base, cookie: cookie(res) },
        })
    ).json()) as { permissions: Record<string, string[]> };
    expect(traderMe.permissions).toEqual({});
});

it("racing creates with one email give one 200 and 409s", async () => {
    const admin = cookie(await signIn("admin@example.com", "changeme"));
    const email = `race${Date.now()}@example.com`;
    const body = {
        email,
        name: "Race",
        password: "password12",
        role: "trader",
    };
    const statuses = await Promise.all(
        Array.from({ length: 5 }, () =>
            post("/users", body, { cookie: admin }).then((r) => r.status),
        ),
    );
    expect(statuses.sort()).toEqual([200, 409, 409, 409, 409]);
    expect((await signIn(email, "password12")).ok).toBe(true);
});

it("two processes bootstrapping at once both start", async () => {
    const auth = createAuth(db, {
        secret: "change-me-to-a-long-random-string",
        baseURL: base,
    });
    const email = `boot${Date.now()}@example.com`;
    const before = await db
        .select({ id: user.id })
        .from(user)
        .where(and(eq(user.role, "admin"), eq(user.banned, false)));
    await db.update(user).set({ banned: true }).where(eq(user.role, "admin"));

    try {
        const results = await Promise.allSettled([
            bootstrapAdmin(db, auth, { email, password: "changeme" }),
            bootstrapAdmin(db, auth, { email, password: "changeme" }),
        ]);
        expect(results.map((r) => r.status)).toEqual([
            "fulfilled",
            "fulfilled",
        ]);
    } finally {
        await db
            .update(user)
            .set({ banned: true })
            .where(eq(user.email, email));
        for (const { id } of before) {
            await db.update(user).set({ banned: false }).where(eq(user.id, id));
        }
    }
});

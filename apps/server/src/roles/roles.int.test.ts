import { firmRoles } from "@propfirmcore/access/server";
import { eq } from "drizzle-orm";
import { afterAll, expect, inject, it } from "vitest";
import { user } from "../auth/auth-schema.ts";
import { createDb } from "../db/db.ts";

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

async function signUp(prefix: string) {
    const email = `${prefix}${Date.now()}@example.com`;
    const res = await post("/auth/sign-up/email", {
        name: prefix,
        email,
        password: "password12",
    });
    expect(res.ok).toBe(true);
    const { user: u } = (await res.json()) as { user: { id: string } };
    return { id: u.id, email, session: cookie(res) };
}

async function until(check: () => Promise<boolean>) {
    for (let i = 0; i < 40; i++) {
        if (await check()) return;
        await new Promise((r) => setTimeout(r, 50));
    }
    throw new Error("condition never held");
}

it("a custom Role grants its Permissions after NOTIFY", async () => {
    const lister = await signUp("lister");
    const listUsers = () =>
        fetch(`${base}/users`, {
            headers: { origin: base, cookie: lister.session },
        });
    expect((await listUsers()).status).toBe(403);

    await db
        .insert(firmRoles)
        .values({ name: "user-lister", permissions: { user: ["list"] } });
    await db
        .update(user)
        .set({ role: "user-lister" })
        .where(eq(user.id, lister.id));
    await sql.notify("firm_roles", "");

    await until(async () => (await listUsers()).status === 200);

    await db.delete(firmRoles).where(eq(firmRoles.name, "user-lister"));
    await sql.notify("firm_roles", "");
    await until(async () => (await listUsers()).status === 403);
});

async function call(
    method: string,
    path: string,
    session: string,
    body?: unknown,
): Promise<Response> {
    return fetch(`${base}${path}`, {
        method,
        headers: {
            origin: base,
            cookie: session,
            ...(body === undefined
                ? {}
                : { "content-type": "application/json" }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
}

async function signIn(email: string, password: string) {
    const res = await post("/auth/sign-in/email", { email, password });
    expect(res.ok).toBe(true);
    return cookie(res);
}

async function setRole(id: string, role: string) {
    await db.update(user).set({ role }).where(eq(user.id, id));
}

type RoleOut = {
    name: string;
    builtin: boolean;
    permissions: Record<string, string[]>;
    userCount: number;
};

it("Role CRUD keeps Staff within their own Role", async () => {
    const admin = await signIn("admin@example.com", "changeme");
    const lead = await signUp("lead");
    const junior = await signUp("junior");

    expect((await call("GET", "/roles", lead.session)).status).toBe(403);

    const leadPerms = {
        role: ["write"],
        user: ["list"],
        payout: ["read", "list", "approve"],
    };
    const created = await call("POST", "/roles", admin, {
        name: "support-lead",
        permissions: leadPerms,
    });
    expect(created.status).toBe(200);
    expect(((await created.json()) as RoleOut).permissions).toEqual({
        user: ["list"],
        role: ["write"],
        payout: ["read", "list", "approve"],
    });

    for (const [name, status] of [
        ["admin", 409],
        ["support-lead", 409],
        ["Bad Name", 400],
    ] as const) {
        const res = await call("POST", "/roles", admin, {
            name,
            permissions: {},
        });
        expect(res.status).toBe(status);
    }
    expect(
        (
            await call("POST", "/roles", admin, {
                name: "odd",
                permissions: { session: ["list"] },
            })
        ).status,
    ).toBe(400);
    expect(
        (
            await call("POST", "/roles", admin, {
                name: "finance",
                permissions: { payout: ["read", "pay"] },
            })
        ).status,
    ).toBe(200);

    await setRole(lead.id, "support-lead");

    const listed = (await (
        await call("GET", "/roles", lead.session)
    ).json()) as RoleOut[];
    expect(listed.map((r) => r.name)).toEqual(
        expect.arrayContaining(["trader", "admin", "support-lead", "finance"]),
    );
    expect(listed.find((r) => r.name === "admin")?.builtin).toBe(true);
    expect(listed.find((r) => r.name === "support-lead")?.userCount).toBe(1);

    expect(
        (
            await call("POST", "/roles", lead.session, {
                name: "support-junior",
                permissions: { payout: ["read"] },
            })
        ).status,
    ).toBe(200);
    expect(
        (
            await call("POST", "/roles", lead.session, {
                name: "sneaky",
                permissions: { firm: ["write"] },
            })
        ).status,
    ).toBe(403);

    expect(
        (
            await call("PUT", "/roles/finance", lead.session, {
                permissions: { payout: ["read"] },
            })
        ).status,
    ).toBe(403);
    expect((await call("DELETE", "/roles/finance", lead.session)).status).toBe(
        403,
    );
    expect(
        (
            await call("PUT", "/roles/support-lead", lead.session, {
                permissions: leadPerms,
            })
        ).status,
    ).toBe(403);
    expect(
        (await call("DELETE", "/roles/support-lead", lead.session)).status,
    ).toBe(403);
    expect(
        (
            await call("PUT", "/roles/admin", admin, {
                permissions: {},
            })
        ).status,
    ).toBe(403);
    expect((await call("DELETE", "/roles/ghost", admin)).status).toBe(404);

    const edited = await call("PUT", "/roles/support-junior", lead.session, {
        permissions: { payout: ["read", "list"] },
    });
    expect(edited.status).toBe(200);
    expect(
        (
            await call("PUT", "/roles/support-junior", lead.session, {
                permissions: { payout: ["pay"] },
            })
        ).status,
    ).toBe(403);

    await setRole(junior.id, "support-junior");
    expect(
        (await call("DELETE", "/roles/support-junior", lead.session)).status,
    ).toBe(409);
    await setRole(junior.id, "trader");
    expect(
        (await call("DELETE", "/roles/support-junior", lead.session)).status,
    ).toBe(204);

    await setRole(lead.id, "trader");
    for (const name of ["support-lead", "finance"]) {
        expect((await call("DELETE", `/roles/${name}`, admin)).status).toBe(
            204,
        );
    }
});

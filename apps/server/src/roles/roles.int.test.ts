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

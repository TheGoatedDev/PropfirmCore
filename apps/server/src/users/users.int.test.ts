import { expect, it } from "vitest";

const base = "http://localhost:3000";

function cookie(res: Response): string {
    return res.headers
        .getSetCookie()
        .map((c) => c.split(";")[0])
        .join("; ");
}

async function post(
    path: string,
    body?: unknown,
    headers: Record<string, string> = {},
): Promise<Response> {
    return fetch(`${base}${path}`, {
        method: "POST",
        headers: {
            origin: base,
            ...(body === undefined
                ? {}
                : { "content-type": "application/json" }),
            ...headers,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
}

async function signIn(email: string) {
    const res = await post("/auth/sign-in/email", {
        email,
        password: "changeme",
    });
    expect(res.ok).toBe(true);
    return cookie(res);
}

type Listed = {
    items: {
        id: string;
        email: string;
        role: string | null;
        banned: boolean;
    }[];
    total: number;
};

it("scopes list, create, ban, and role", async () => {
    const admin = await signIn("admin@example.com");
    const email = `u${Date.now()}@example.com`;
    const signup = await post("/auth/sign-up/email", {
        name: "Trader",
        email,
        password: "password12",
    });
    expect(signup.ok).toBe(true);
    const trader = cookie(signup);

    const denied = await fetch(`${base}/users`, {
        headers: { origin: base, cookie: trader },
    });
    expect(denied.status).toBe(403);

    const asAdmin = await fetch(`${base}/users?pageSize=100`, {
        headers: { origin: base, cookie: admin },
    });
    expect(asAdmin.ok).toBe(true);
    const adminList = (await asAdmin.json()) as Listed;
    expect(adminList.items.some((u) => u.email === "admin@example.com")).toBe(
        true,
    );

    const createdEmail = `c${Date.now()}@example.com`;
    const created = await post(
        "/users",
        {
            role: "trader",
            email: createdEmail,
            name: "New",
            password: "password12",
        },
        { cookie: admin },
    );
    expect(created.ok).toBe(true);
    const createdUser = (await created.json()) as Listed["items"][0];
    expect(createdUser.email).toBe(createdEmail);
    expect(createdUser.role).toBe("trader");

    const found = await fetch(
        `${base}/users?q=${encodeURIComponent(createdEmail)}`,
        { headers: { origin: base, cookie: admin } },
    );
    const foundList = (await found.json()) as Listed;
    expect(foundList.total).toBe(1);
    expect(foundList.items[0]?.id).toBe(createdUser.id);

    const me = await fetch(`${base}/auth/me`, {
        headers: { origin: base, cookie: admin },
    });
    const adminMe = (await me.json()) as { id: string };
    const selfBan = await post(
        `/users/${adminMe.id}/ban`,
        { banned: true },
        { cookie: admin },
    );
    expect(selfBan.status).toBe(403);
    const selfRole = await post(
        `/users/${adminMe.id}/role`,
        { role: "trader" },
        { cookie: admin },
    );
    expect(selfRole.status).toBe(403);

    const roleRes = await post(
        `/users/${createdUser.id}/role`,
        { role: "admin" },
        { cookie: admin },
    );
    expect(roleRes.ok).toBe(true);
    expect(((await roleRes.json()) as Listed["items"][0]).role).toBe("admin");

    const banRes = await post(
        `/users/${createdUser.id}/ban`,
        { banned: true },
        { cookie: admin },
    );
    expect(banRes.ok).toBe(true);
    expect(((await banRes.json()) as Listed["items"][0]).banned).toBe(true);

    const dup = await post(
        "/users",
        {
            role: "trader",
            email: createdEmail,
            name: "Dup",
            password: "password12",
        },
        { cookie: admin },
    );
    expect(dup.status).toBe(409);
});

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
        kind: string;
        role: string | null;
        banned: boolean;
    }[];
    total: number;
};

it("scopes list, create, ban, and role", async () => {
    const admin = await signIn("admin@example.com");
    const operator = await signIn("operator@example.com");
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
    expect(adminList.items.some((u) => u.kind === "operator")).toBe(false);
    expect(adminList.items.some((u) => u.email === "admin@example.com")).toBe(
        true,
    );

    const asOp = await fetch(`${base}/users?kind=operator`, {
        headers: { origin: base, cookie: operator },
    });
    expect(asOp.ok).toBe(true);
    const opList = (await asOp.json()) as Listed;
    expect(opList.items.some((u) => u.email === "operator@example.com")).toBe(
        true,
    );
    expect(
        opList.items.every((u) => u.kind === "operator" && u.role === null),
    ).toBe(true);

    const adminMakesOp = await post(
        "/users",
        {
            kind: "operator",
            email: `op${Date.now()}@example.com`,
            name: "Nope",
            password: "password12",
        },
        { cookie: admin },
    );
    expect(adminMakesOp.status).toBe(403);

    const createdEmail = `c${Date.now()}@example.com`;
    const created = await post(
        "/users",
        {
            kind: "firmUser",
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
    expect(createdUser.kind).toBe("firmUser");

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

    const opRow = opList.items[0];
    expect(opRow).toBeTruthy();
    const adminBansOp = await post(
        `/users/${opRow?.id}/ban`,
        { banned: true },
        { cookie: admin },
    );
    expect(adminBansOp.status).toBe(404);

    const dup = await post(
        "/users",
        {
            kind: "firmUser",
            role: "trader",
            email: createdEmail,
            name: "Dup",
            password: "password12",
        },
        { cookie: admin },
    );
    expect(dup.status).toBe(409);

    const opCreatedEmail = `n${Date.now()}@example.com`;
    const opCreated = await post(
        "/users",
        {
            kind: "operator",
            email: opCreatedEmail,
            name: "Op",
            password: "password12",
        },
        { cookie: operator },
    );
    expect(opCreated.ok).toBe(true);
    const newOp = (await opCreated.json()) as Listed["items"][0];
    expect(newOp.kind).toBe("operator");
    expect(newOp.role).toBeNull();

    const adminSeesOp = await fetch(
        `${base}/users?q=${encodeURIComponent(opCreatedEmail)}`,
        { headers: { origin: base, cookie: admin } },
    );
    expect(((await adminSeesOp.json()) as Listed).total).toBe(0);
});

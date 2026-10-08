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

async function put(path: string, body: unknown, session: string) {
    return post(path, body, { cookie: session });
}

async function signUpAs(prefix: string) {
    const email = `${prefix}${Date.now()}@example.com`;
    const res = await post("/auth/sign-up/email", {
        name: prefix,
        email,
        password: "password12",
    });
    expect(res.ok).toBe(true);
    const { user } = (await res.json()) as { user: { id: string } };
    return { id: user.id, email };
}

it("custom Roles: Staff act only within their own Role", async () => {
    const admin = await signIn("admin@example.com");
    const adminId = (
        (await (
            await fetch(`${base}/auth/me`, {
                headers: { origin: base, cookie: admin },
            })
        ).json()) as { id: string }
    ).id;
    const perms = { user: ["list", "create", "ban", "set-role"] };
    expect(
        (await put("/roles", { name: "user-ops", permissions: perms }, admin))
            .ok,
    ).toBe(true);

    const ops = await signUpAs("ops");
    const assigned = await put(
        `/users/${ops.id}/role`,
        { role: "user-ops" },
        admin,
    );
    expect(assigned.status).toBe(200);
    expect(((await assigned.json()) as Listed["items"][0]).role).toBe(
        "user-ops",
    );
    expect(
        (await put(`/users/${ops.id}/role`, { role: "ghost" }, admin)).status,
    ).toBe(400);

    const opsSession = cookie(
        await post("/auth/sign-in/email", {
            email: ops.email,
            password: "password12",
        }),
    );
    expect(
        (await put(`/users/${adminId}/ban`, { banned: true }, opsSession))
            .status,
    ).toBe(403);
    expect(
        (await put(`/users/${adminId}/role`, { role: "trader" }, opsSession))
            .status,
    ).toBe(403);
    const stamp = Date.now();
    expect(
        (
            await put(
                "/users",
                {
                    role: "admin",
                    email: `esc${stamp}@example.com`,
                    name: "Esc",
                    password: "password12",
                },
                opsSession,
            )
        ).status,
    ).toBe(403);

    const peer = await signUpAs("peer");
    expect(
        (await put(`/users/${peer.id}/role`, { role: "user-ops" }, opsSession))
            .status,
    ).toBe(200);
    expect(
        (await put(`/users/${peer.id}/ban`, { banned: true }, opsSession))
            .status,
    ).toBe(200);

    const filtered = (await (
        await fetch(`${base}/users?role=user-ops&pageSize=100`, {
            headers: { origin: base, cookie: admin },
        })
    ).json()) as Listed;
    expect(filtered.items.map((u) => u.id)).toEqual(
        expect.arrayContaining([ops.id, peer.id]),
    );
});

it("refuses to leave no unbanned Admin", async () => {
    const admin = await signIn("admin@example.com");
    const adminId = (
        (await (
            await fetch(`${base}/auth/me`, {
                headers: { origin: base, cookie: admin },
            })
        ).json()) as { id: string }
    ).id;
    const all = {
        user: ["list", "create", "ban", "set-role"],
        role: ["write"],
        payment: ["complete", "read", "list"],
        tradingAccount: [
            "read",
            "list",
            "fail",
            "pass",
            "resync",
            "reactivate",
        ],
        payout: ["read", "list", "approve", "reject", "pay"],
        firm: ["read", "write"],
        broker: ["credentials"],
        kyc: ["write"],
    };
    expect(
        (await put("/roles", { name: "everything", permissions: all }, admin))
            .ok,
    ).toBe(true);
    const root = await signUpAs("root");
    expect(
        (await put(`/users/${root.id}/role`, { role: "everything" }, admin)).ok,
    ).toBe(true);
    const rootSession = cookie(
        await post("/auth/sign-in/email", {
            email: root.email,
            password: "password12",
        }),
    );

    const others = (await (
        await fetch(`${base}/users?role=admin&banned=false&pageSize=100`, {
            headers: { origin: base, cookie: admin },
        })
    ).json()) as Listed;
    for (const u of others.items) {
        if (u.id === adminId) continue;
        expect(
            (await put(`/users/${u.id}/ban`, { banned: true }, rootSession)).ok,
        ).toBe(true);
    }

    expect(
        (await put(`/users/${adminId}/ban`, { banned: true }, rootSession))
            .status,
    ).toBe(409);
    expect(
        (await put(`/users/${adminId}/role`, { role: "trader" }, rootSession))
            .status,
    ).toBe(409);

    for (const u of others.items) {
        if (u.id === adminId) continue;
        await put(`/users/${u.id}/ban`, { banned: false }, admin);
    }
});

it("concurrent bans cannot remove the last two Admins", async () => {
    const admin = await signIn("admin@example.com");
    const adminId = (
        (await (
            await fetch(`${base}/auth/me`, {
                headers: { origin: base, cookie: admin },
            })
        ).json()) as { id: string }
    ).id;
    const stamp = Date.now();
    const all = {
        user: ["list", "create", "ban", "set-role"],
        role: ["write"],
        payment: ["complete", "read", "list"],
        tradingAccount: [
            "read",
            "list",
            "fail",
            "pass",
            "resync",
            "reactivate",
        ],
        payout: ["read", "list", "approve", "reject", "pay"],
        firm: ["read", "write"],
        broker: ["credentials"],
        kyc: ["write"],
    };
    const roleName = `all-${stamp}`;
    expect(
        (await put("/roles", { name: roleName, permissions: all }, admin)).ok,
    ).toBe(true);

    async function create(prefix: string, role: string) {
        const email = `${prefix}${stamp}@example.com`;
        const res = await put(
            "/users",
            { email, name: prefix, password: "password12", role },
            admin,
        );
        expect(res.ok).toBe(true);
        const { id } = (await res.json()) as { id: string };
        const session = cookie(
            await post("/auth/sign-in/email", {
                email,
                password: "password12",
            }),
        );
        return { id, session };
    }
    const second = await create("second", "admin");
    const rootA = await create("rootA", roleName);
    const rootB = await create("rootB", roleName);

    // Leave exactly two unbanned Admins: the bootstrap one and `second`.
    const others = (
        (await (
            await fetch(`${base}/users?role=admin&banned=false&pageSize=100`, {
                headers: { origin: base, cookie: admin },
            })
        ).json()) as Listed
    ).items.filter((u) => u.id !== adminId && u.id !== second.id);
    for (const u of others) {
        expect(
            (await put(`/users/${u.id}/ban`, { banned: true }, admin)).ok,
        ).toBe(true);
    }

    const statuses = await Promise.all([
        put(`/users/${adminId}/ban`, { banned: true }, rootA.session),
        put(`/users/${second.id}/ban`, { banned: true }, rootB.session),
    ]).then((rs) => rs.map((r) => r.status).sort());
    expect(statuses).toEqual([200, 409]);

    for (const id of [adminId, second.id, ...others.map((u) => u.id)]) {
        await put(`/users/${id}/ban`, { banned: false }, rootA.session);
    }
});

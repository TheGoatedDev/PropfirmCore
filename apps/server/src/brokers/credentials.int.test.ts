import { expect, it } from "vitest";

const base = "http://localhost:3000";

type BrokerView = {
    id: string;
    name: string;
    bridge: { provider: string; url?: string };
    hasIngestKey: boolean;
    hasBridgeKey: boolean;
};
type FirmView = { brokers: BrokerView[] } & Record<string, unknown>;

function cookie(res: Response): string {
    return res.headers
        .getSetCookie()
        .map((c) => c.split(";")[0])
        .join("; ");
}

async function call(
    method: string,
    path: string,
    headers: Record<string, string>,
    body?: unknown,
): Promise<Response> {
    return fetch(`${base}${path}`, {
        method,
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

async function signIn(): Promise<Record<string, string>> {
    const res = await call(
        "POST",
        "/auth/sign-in/email",
        {},
        { email: "admin@example.com", password: "changeme" },
    );
    expect(res.ok).toBe(true);
    return { cookie: cookie(res) };
}

async function firm(admin: Record<string, string>): Promise<FirmView> {
    const res = await call("GET", "/firm", admin);
    expect(res.status).toBe(200);
    return (await res.json()) as FirmView;
}

async function addBroker(
    admin: Record<string, string>,
    name: string,
    bridge: BrokerView["bridge"],
): Promise<BrokerView> {
    const live = await firm(admin);
    const put = await call("PUT", "/firm", admin, {
        ...live,
        brokers: [...live.brokers, { name, bridge }],
    });
    expect(put.status).toBe(200);
    const after = (await put.json()) as FirmView;
    const br = after.brokers.find((b) => b.name === name);
    if (!br) throw new Error("broker not created");
    return br;
}

function ingestGet(key: string): Promise<Response> {
    return call("GET", "/ingest/trading-accounts/none", { "X-Api-Key": key });
}

it("seeded loopback key works; new broker has no key", async () => {
    const admin = await signIn();
    const live = await firm(admin);
    const loop = live.brokers.find((b) => b.id === "loopback");
    expect(loop?.hasIngestKey).toBe(true);
    expect(JSON.stringify(live)).not.toContain('ingestKey"');
    expect((await ingestGet("dev")).status).toBe(404);

    const br = await addBroker(admin, `keyless-${Date.now()}`, {
        provider: "loopback",
    });
    expect(br.hasIngestKey).toBe(false);
    expect(br.hasBridgeKey).toBe(false);
});

it("rotate returns a key once; old key fails; revoke refuses ingest", async () => {
    const admin = await signIn();
    const br = await addBroker(admin, `rotate-${Date.now()}`, {
        provider: "loopback",
    });
    const path = `/firm/brokers/${br.id}/ingest-key`;

    const first = await call("POST", path, admin);
    expect(first.status).toBe(200);
    const { ingestKey: k1 } = (await first.json()) as { ingestKey: string };
    expect(k1).toMatch(/^pfc_ik_[A-Za-z0-9_-]{43}$/);
    expect((await ingestGet(k1)).status).toBe(404);

    const second = await call("POST", path, admin);
    const { ingestKey: k2 } = (await second.json()) as { ingestKey: string };
    expect(k2).not.toBe(k1);
    expect((await ingestGet(k1)).status).toBe(401);
    expect((await ingestGet(k2)).status).toBe(404);

    const flagged = (await firm(admin)).brokers.find((b) => b.id === br.id);
    expect(flagged?.hasIngestKey).toBe(true);

    const revoked = await call("DELETE", path, admin);
    expect(revoked.status).toBe(200);
    expect(((await revoked.json()) as BrokerView).hasIngestKey).toBe(false);
    expect((await ingestGet(k2)).status).toBe(401);
    expect((await ingestGet("dev")).status).toBe(404);
});

it("bridge key: webhook only; set and clear", async () => {
    const admin = await signIn();
    const hook = await addBroker(admin, `hook-${Date.now()}`, {
        provider: "webhook",
        url: "http://localhost:4999/",
    });
    const set = await call(
        "PUT",
        `/firm/brokers/${hook.id}/bridge-key`,
        admin,
        { key: "bk" },
    );
    expect(set.status).toBe(200);
    expect(((await set.json()) as BrokerView).hasBridgeKey).toBe(true);
    const cleared = await call(
        "PUT",
        `/firm/brokers/${hook.id}/bridge-key`,
        admin,
        { key: null },
    );
    expect(((await cleared.json()) as BrokerView).hasBridgeKey).toBe(false);

    const onLoopback = await call(
        "PUT",
        "/firm/brokers/loopback/bridge-key",
        admin,
        { key: "bk" },
    );
    expect(onLoopback.status).toBe(400);
});

it("PUT /firm rejects keys; 404 unknown broker; trader 403", async () => {
    const admin = await signIn();
    const live = await firm(admin);
    const leaked = await call("PUT", "/firm", admin, {
        ...live,
        brokers: live.brokers.map((b) => ({ ...b, ingestKey: "x" })),
    });
    expect(leaked.status).toBe(400);

    const missing = await call("POST", "/firm/brokers/nope/ingest-key", admin);
    expect(missing.status).toBe(404);

    const signup = await call(
        "POST",
        "/auth/sign-up/email",
        {},
        {
            name: "Trader",
            email: `k${Date.now()}@example.com`,
            password: "password12",
        },
    );
    expect(signup.ok).toBe(true);
    const trader = { cookie: cookie(signup) };
    const denied = await call(
        "POST",
        "/firm/brokers/loopback/ingest-key",
        trader,
    );
    expect(denied.status).toBe(403);
    expect((await ingestGet("dev")).status).toBe(404);
});

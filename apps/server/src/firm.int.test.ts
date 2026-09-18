import { expect, it } from "vitest";
import { defaultFirmPath, loadFirmFromPath } from "./firm.ts";

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

it("seed GET /firm; admin PUT; trader 403; in-use product blocked", async () => {
    const seed = loadFirmFromPath(defaultFirmPath());
    const signin = await post("/auth/sign-in/email", {
        email: "admin@example.com",
        password: "changeme",
    });
    expect(signin.ok).toBe(true);
    const op = { cookie: cookie(signin) };

    const me = await fetch(`${base}/auth/me`, {
        headers: { origin: base, cookie: op.cookie },
    });
    expect(me.ok).toBe(true);
    const who = (await me.json()) as { role: string };
    expect(who.role).toBe("admin");

    const got = await fetch(`${base}/firm`, {
        headers: { origin: base, cookie: op.cookie },
    });
    expect(got.status).toBe(200);
    const live = (await got.json()) as { id: string; name: string };
    expect(live.id).toBe(seed.id);
    expect(live.name).toBe(seed.name);

    const email = `f${Date.now()}@example.com`;
    const signup = await post("/auth/sign-up/email", {
        name: "Trader",
        email,
        password: "password12",
    });
    expect(signup.ok).toBe(true);
    const trader = { cookie: cookie(signup) };
    const traderMe = await fetch(`${base}/auth/me`, {
        headers: { origin: base, cookie: trader.cookie },
    });
    const traderWho = (await traderMe.json()) as { role: string };
    expect(traderWho.role).toBe("trader");

    const forbidden = await fetch(`${base}/firm`, {
        method: "PUT",
        headers: {
            origin: base,
            "content-type": "application/json",
            cookie: trader.cookie,
        },
        body: JSON.stringify(seed),
    });
    expect(forbidden.status).toBe(403);

    const renamed = { ...seed, name: "Renamed" };
    const put = await fetch(`${base}/firm`, {
        method: "PUT",
        headers: {
            origin: base,
            "content-type": "application/json",
            cookie: op.cookie,
        },
        body: JSON.stringify(renamed),
    });
    expect(put.status).toBe(200);
    expect(((await put.json()) as { name: string }).name).toBe("Renamed");

    const buy = await post(
        "/products/load/buy",
        { brokerId: "loopback" },
        { cookie: trader.cookie },
    );
    expect(buy.ok).toBe(true);

    const dropped = {
        ...seed,
        name: "Renamed",
        products: seed.products.filter((p) => p.id !== "load"),
    };
    const blocked = await fetch(`${base}/firm`, {
        method: "PUT",
        headers: {
            origin: base,
            "content-type": "application/json",
            cookie: op.cookie,
        },
        body: JSON.stringify(dropped),
    });
    expect(blocked.status).toBe(400);
});

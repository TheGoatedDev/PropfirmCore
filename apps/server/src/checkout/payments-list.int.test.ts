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

async function signUp(prefix: string): Promise<string> {
    const res = await post("/auth/sign-up/email", {
        name: "Trader",
        email: `${prefix}${Date.now()}@example.com`,
        password: "password12",
    });
    expect(res.ok).toBe(true);
    return cookie(res);
}

async function buyPaid(trader: string): Promise<string> {
    const products = (await (
        await fetch(`${base}/products`, { headers: { cookie: trader } })
    ).json()) as {
        id: string;
        brokers: { id: string }[];
        phases: { fee?: number }[];
    }[];
    const product = products.find((p) => (p.phases[0]?.fee ?? 0) > 0);
    if (!product?.brokers[0]) throw new Error("no paid product");
    const res = await post(
        `/products/${product.id}/buy`,
        { brokerId: product.brokers[0].id },
        { cookie: trader },
    );
    expect(res.ok).toBe(true);
    const body = (await res.json()) as { payment: { id: string } };
    return body.payment.id;
}

type Payment = { id: string; userId: string; status: string };

it("lists payments: admin sees all, a trader sees only their own", async () => {
    const anon = await fetch(`${base}/payments`);
    expect(anon.status).toBe(401);

    const a = await signUp("pa");
    const b = await signUp("pb");
    const aPayment = await buyPaid(a);
    const bPayment = await buyPaid(b);

    const mine = await fetch(`${base}/payments`, { headers: { cookie: a } });
    expect(mine.status).toBe(200);
    const mineIds = ((await mine.json()) as Payment[]).map((p) => p.id);
    expect(mineIds).toContain(aPayment);
    expect(mineIds).not.toContain(bPayment);

    const signin = await post("/auth/sign-in/email", {
        email: "admin@example.com",
        password: "changeme",
    });
    expect(signin.ok).toBe(true);
    const all = await fetch(`${base}/payments`, {
        headers: { cookie: cookie(signin) },
    });
    expect(all.status).toBe(200);
    const allRows = (await all.json()) as Payment[];
    const allIds = allRows.map((p) => p.id);
    expect(allIds).toContain(aPayment);
    expect(allIds).toContain(bPayment);
    expect(allRows.find((p) => p.id === aPayment)?.status).toBe("pending");
});

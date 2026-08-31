import { createRoute, type OpenAPIHono, z } from "@hono/zod-openapi";
import type { FirmConfig } from "@propfirmcore/config";
import { eq } from "drizzle-orm";
import type { Auth } from "../auth.ts";
import type { Db } from "../db.ts";
import { payments } from "../db.ts";
import { errorSchema, httpDesc } from "../http-desc.ts";
import { tags } from "../openapi.ts";
import { roleHasPermission } from "../permissions.ts";
import { getAdapter } from "./adapters.ts";
import { completePayment, startCheckout } from "./service.ts";

const paymentSchema = z.object({
    id: z.string(),
    userId: z.string(),
    productId: z.string(),
    amount: z.number(),
    currency: z.string(),
    provider: z.string(),
    providerRef: z.string().nullable(),
    status: z.enum(["pending", "paid", "failed", "canceled"]),
    accountId: z.string().nullable(),
});

type Deps = { db: Db; firm: FirmConfig; auth: Auth };

function sessionRole(user: { role?: string | null }): string {
    return user.role ?? "trader";
}

export function mountCheckout(app: OpenAPIHono, deps: Deps) {
    app.openapi(
        createRoute({
            method: "post",
            path: "/products/{id}/buy",
            tags: [tags.trader],
            request: { params: z.object({ id: z.string().min(1) }) },
            responses: {
                200: {
                    description:
                        "Checkout started. Follow redirectUrl if set; free products return an account immediately.",
                    content: {
                        "application/json": {
                            schema: z.object({
                                payment: paymentSchema.nullable(),
                                account: z.unknown().nullable(),
                                redirectUrl: z.string().nullable(),
                            }),
                        },
                    },
                },
                401: {
                    description: httpDesc.unauthorized,
                    content: { "application/json": { schema: errorSchema } },
                },
                400: {
                    description: httpDesc.badRequest,
                    content: { "application/json": { schema: errorSchema } },
                },
            },
        }),
        async (c) => {
            const session = await deps.auth.api.getSession({
                headers: c.req.raw.headers,
            });
            if (!session) return c.json({ error: "unauthorized" }, 401);
            const { id } = c.req.valid("param");
            const result = await startCheckout(deps.db, deps.firm, {
                userId: session.user.id,
                productId: id,
            });
            if (!result.ok) {
                return c.json({ error: result.error }, 400);
            }
            return c.json(
                {
                    payment: result.payment ?? null,
                    account: result.account ?? null,
                    redirectUrl: result.redirectUrl ?? null,
                },
                200,
            );
        },
    );

    app.openapi(
        createRoute({
            method: "post",
            path: "/payments/{id}/complete",
            tags: [tags.admin],
            request: { params: z.object({ id: z.string().min(1) }) },
            responses: {
                200: {
                    description:
                        "Payment marked paid and a trading account opened.",
                    content: {
                        "application/json": {
                            schema: z.object({
                                payment: paymentSchema,
                                account: z.unknown().nullable(),
                            }),
                        },
                    },
                },
                400: {
                    description: httpDesc.badRequest,
                    content: { "application/json": { schema: errorSchema } },
                },
                401: {
                    description: httpDesc.unauthorized,
                    content: { "application/json": { schema: errorSchema } },
                },
                403: {
                    description: httpDesc.forbidden,
                    content: { "application/json": { schema: errorSchema } },
                },
            },
        }),
        async (c) => {
            const session = await deps.auth.api.getSession({
                headers: c.req.raw.headers,
            });
            if (!session) return c.json({ error: "unauthorized" }, 401);
            if (
                !roleHasPermission(
                    sessionRole(session.user),
                    "payment",
                    "complete",
                )
            ) {
                return c.json({ error: "forbidden" }, 403);
            }
            const { id } = c.req.valid("param");
            const adapter = getAdapter(deps.firm.checkout.provider);
            if (!adapter) return c.json({ error: "unknown provider" }, 400);
            const proof = await adapter.verify({ kind: "id", paymentId: id });
            if (!proof.ok) return c.json({ error: proof.reason }, 400);
            const result = await completePayment(
                deps.db,
                deps.firm,
                proof.paymentId,
            );
            if (!result.ok) return c.json({ error: result.error }, 400);
            return c.json(
                { payment: result.payment, account: result.account },
                200,
            );
        },
    );

    app.openapi(
        createRoute({
            method: "get",
            path: "/payments/{id}",
            tags: [tags.trader],
            request: { params: z.object({ id: z.string().min(1) }) },
            responses: {
                200: {
                    description: "The payment.",
                    content: { "application/json": { schema: paymentSchema } },
                },
                401: {
                    description: httpDesc.unauthorized,
                    content: { "application/json": { schema: errorSchema } },
                },
                403: {
                    description: httpDesc.forbidden,
                    content: { "application/json": { schema: errorSchema } },
                },
                404: {
                    description: httpDesc.notFound,
                    content: { "application/json": { schema: errorSchema } },
                },
            },
        }),
        async (c) => {
            const session = await deps.auth.api.getSession({
                headers: c.req.raw.headers,
            });
            if (!session) return c.json({ error: "unauthorized" }, 401);
            const { id } = c.req.valid("param");
            const rows = await deps.db
                .select()
                .from(payments)
                .where(eq(payments.id, id))
                .limit(1);
            if (!rows[0]) return c.json({ error: "not found" }, 404);
            const role = sessionRole(session.user);
            const own = rows[0].userId === session.user.id;
            if (!own && !roleHasPermission(role, "payment", "read")) {
                return c.json({ error: "forbidden" }, 403);
            }
            return c.json(rows[0], 200);
        },
    );

    app.post("/checkout/webhook/:provider", async (c) => {
        const provider = c.req.param("provider");
        const adapter = getAdapter(provider);
        if (!adapter) return c.json({ error: "not found" }, 404);
        const body = await c.req.text();
        const proof = await adapter.verify({
            kind: "webhook",
            headers: c.req.raw.headers,
            body,
        });
        if (!proof.ok) return c.json({ error: proof.reason }, 400);
        const result = await completePayment(
            deps.db,
            deps.firm,
            proof.paymentId,
        );
        if (!result.ok) return c.json({ error: result.error }, 400);
        return c.json({ ok: true, paymentId: proof.paymentId });
    });
}

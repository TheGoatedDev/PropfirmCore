import { createRoute, type OpenAPIHono, z } from "@hono/zod-openapi";
import { roleHasPermission } from "@propfirmcore/access/server";
import type { FirmConfig } from "@propfirmcore/config";
import { count, sql, sum } from "drizzle-orm";
import { DateTime } from "luxon";
import type { Auth } from "../auth/auth.ts";
import { user } from "../auth/auth-schema.ts";
import type { Db } from "../db/db.ts";
import {
    fills,
    payments,
    payouts,
    ruleBreaches,
    tradingAccounts,
} from "../db/db.ts";
import { errorSchema, httpDesc } from "../http/http-desc.ts";
import { tags } from "../http/openapi.ts";
import { roleOf } from "../http/session.ts";

const DAYS = 14;

// Day buckets group by column position: the timezone is a bound parameter,
// and Postgres treats the same parameter in SELECT and GROUP BY as different.

const bucket = z.object({ count: z.number(), amount: z.number() });
const statusCounts = z.object({
    active: z.number(),
    passed: z.number(),
    failed: z.number(),
});
const overviewSchema = z.object({
    accounts: statusCounts.extend({
        byProduct: z.array(statusCounts.extend({ productId: z.string() })),
    }),
    payments: z.object({
        pending: bucket,
        paid: bucket,
        failed: bucket,
        canceled: bucket,
    }),
    payouts: z.object({
        pending: bucket,
        approved: bucket,
        rejected: bucket,
        paid: bucket,
    }),
    days: z.array(z.string()),
    fills: z.array(z.number()),
    signups: z.array(z.number()),
    breaches: z.object({
        warn: z.array(z.number()),
        flag: z.array(z.number()),
    }),
});

type Deps = {
    db: Db;
    firm: FirmConfig;
    holder?: { current: FirmConfig };
    auth: Auth;
};

function buckets<K extends string>(
    keys: readonly K[],
    rows: { status: string; n: number; total: string | number | null }[],
): Record<K, { count: number; amount: number }> {
    const out = {} as Record<K, { count: number; amount: number }>;
    for (const k of keys) out[k] = { count: 0, amount: 0 };
    for (const r of rows) {
        if (r.status in out) {
            out[r.status as K] = { count: r.n, amount: Number(r.total ?? 0) };
        }
    }
    return out;
}

function perDay(days: string[], rows: { day: string; n: number }[]): number[] {
    const byDay = new Map(rows.map((r) => [r.day, r.n]));
    return days.map((d) => byDay.get(d) ?? 0);
}

export function mountStats(app: OpenAPIHono, deps: Deps) {
    app.openapi(
        createRoute({
            method: "get",
            path: "/stats/overview",
            tags: [tags.stats],
            responses: {
                200: {
                    description:
                        "Admin home figures. Daily series cover the last 14 trading-clock days in the firm timezone, oldest first.",
                    content: { "application/json": { schema: overviewSchema } },
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
                    roleOf(session.user),
                    "tradingAccount",
                    "list",
                )
            ) {
                return c.json({ error: "forbidden" }, 403);
            }

            const tz = (deps.holder?.current ?? deps.firm).dailyClose.tz;
            const today = DateTime.now().setZone(tz).startOf("day");
            const start = today.minus({ days: DAYS - 1 });
            const days = Array.from(
                { length: DAYS },
                (_, i) => start.plus({ days: i }).toISODate() ?? "",
            );
            const since = start.toUTC().toISO() ?? "";
            const db = deps.db;

            const fillDay = sql<string>`to_char((${fills.ts}::timestamptz at time zone ${tz})::date, 'YYYY-MM-DD')`;
            const breachDay = sql<string>`to_char((${ruleBreaches.ts}::timestamptz at time zone ${tz})::date, 'YYYY-MM-DD')`;
            const signupDay = sql<string>`to_char(((${user.createdAt} at time zone 'UTC') at time zone ${tz})::date, 'YYYY-MM-DD')`;

            const [
                accountRows,
                paymentRows,
                payoutRows,
                fillRows,
                signupRows,
                breachRows,
            ] = await Promise.all([
                db
                    .select({
                        productId: tradingAccounts.productId,
                        status: tradingAccounts.status,
                        n: count(),
                    })
                    .from(tradingAccounts)
                    .groupBy(tradingAccounts.productId, tradingAccounts.status),
                db
                    .select({
                        status: payments.status,
                        n: count(),
                        total: sum(payments.amount),
                    })
                    .from(payments)
                    .groupBy(payments.status),
                db
                    .select({
                        status: payouts.status,
                        n: count(),
                        total: sum(payouts.amount),
                    })
                    .from(payouts)
                    .groupBy(payouts.status),
                db
                    .select({ day: fillDay, n: count() })
                    .from(fills)
                    .where(
                        sql`${fills.ts}::timestamptz >= ${since}::timestamptz`,
                    )
                    .groupBy(sql`1`),
                db
                    .select({ day: signupDay, n: count() })
                    .from(user)
                    .where(
                        sql`(${user.createdAt} at time zone 'UTC') >= ${since}::timestamptz`,
                    )
                    .groupBy(sql`1`),
                db
                    .select({
                        day: breachDay,
                        severity: ruleBreaches.severity,
                        n: count(),
                    })
                    .from(ruleBreaches)
                    .where(
                        sql`${ruleBreaches.ts}::timestamptz >= ${since}::timestamptz`,
                    )
                    .groupBy(sql`1`, sql`2`),
            ]);

            const products = new Map<
                string,
                {
                    productId: string;
                    active: number;
                    passed: number;
                    failed: number;
                }
            >();
            for (const r of accountRows) {
                const p = products.get(r.productId) ?? {
                    productId: r.productId,
                    active: 0,
                    passed: 0,
                    failed: 0,
                };
                p[r.status] += r.n;
                products.set(r.productId, p);
            }
            const byProduct = [...products.values()];
            const total = (k: "active" | "passed" | "failed") =>
                byProduct.reduce((n, p) => n + p[k], 0);

            return c.json(
                {
                    accounts: {
                        active: total("active"),
                        passed: total("passed"),
                        failed: total("failed"),
                        byProduct,
                    },
                    payments: buckets(
                        ["pending", "paid", "failed", "canceled"] as const,
                        paymentRows,
                    ),
                    payouts: buckets(
                        ["pending", "approved", "rejected", "paid"] as const,
                        payoutRows,
                    ),
                    days,
                    fills: perDay(days, fillRows),
                    signups: perDay(days, signupRows),
                    breaches: {
                        warn: perDay(
                            days,
                            breachRows.filter((r) => r.severity === "warn"),
                        ),
                        flag: perDay(
                            days,
                            breachRows.filter((r) => r.severity === "flag"),
                        ),
                    },
                },
                200,
            );
        },
    );
}

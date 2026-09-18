import { readFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import {
    type FirmConfig,
    ingestKeyEnvName,
    loadFirmConfig,
    parseFirmConfig,
} from "@propfirmcore/config";
import { eq, sql } from "drizzle-orm";
import {
    brokers,
    type Db,
    firms,
    payments,
    phases,
    productBrokers,
    products,
    tradingAccounts,
} from "./db/db.ts";

const repoRoot = resolve(import.meta.dirname, "../../..");

export function loadFirmFromPath(path: string): FirmConfig {
    return loadFirmConfig(readFileSync(path, "utf8"));
}

export function defaultFirmPath(fromEnv?: string): string {
    if (!fromEnv) return resolve(repoRoot, "firm.example.json");
    if (isAbsolute(fromEnv)) return fromEnv;
    return resolve(repoRoot, fromEnv);
}

export function missingInUse(
    next: FirmConfig,
    used: { products: string[]; brokers: string[] },
): string[] {
    const p = new Set(next.products.map((x) => x.id));
    const b = new Set(next.brokers.map((x) => x.id));
    return [
        ...used.products
            .filter((id) => !p.has(id))
            .map((id) => `product ${id}`),
        ...used.brokers.filter((id) => !b.has(id)).map((id) => `broker ${id}`),
    ];
}

export function missingIngestKeys(
    next: FirmConfig,
    env: NodeJS.Dict<string> = process.env,
): string[] {
    return next.brokers
        .map((br) => ingestKeyEnvName(br.id))
        .filter((name) => !env[name]);
}

export function assembleFirm(input: {
    firm: typeof firms.$inferSelect;
    brokers: (typeof brokers.$inferSelect)[];
    products: (typeof products.$inferSelect)[];
    productBrokers: (typeof productBrokers.$inferSelect)[];
    phases: (typeof phases.$inferSelect)[];
}): FirmConfig {
    const allow = new Map<string, string[]>();
    for (const row of input.productBrokers) {
        const list = allow.get(row.productId) ?? [];
        list.push(row.brokerId);
        allow.set(row.productId, list);
    }
    const byProduct = new Map<string, (typeof phases.$inferSelect)[]>();
    for (const row of input.phases) {
        const list = byProduct.get(row.productId) ?? [];
        list.push(row);
        byProduct.set(row.productId, list);
    }
    return parseFirmConfig({
        id: input.firm.id,
        name: input.firm.name,
        dailyClose: {
            tz: input.firm.dailyCloseTz,
            time: input.firm.dailyCloseTime,
        },
        modules: {
            affiliates: input.firm.modulesAffiliates,
            kyc: {
                enabled: input.firm.modulesKyc,
                gate: input.firm.modulesKycGate,
            },
            multiBrand: input.firm.modulesMultiBrand,
        },
        checkout: {
            provider: input.firm.checkoutProvider,
            currency: input.firm.checkoutCurrency,
        },
        payout: { onUncoverable: input.firm.payoutOnUncoverable },
        brokers: input.brokers.map((br) => ({
            id: br.id,
            name: br.name,
            bridge: {
                provider: br.bridgeProvider,
                ...(br.bridgeUrl ? { url: br.bridgeUrl } : {}),
            },
        })),
        products: input.products.map((p) => {
            const payout =
                p.payoutSplit != null && p.payoutMode
                    ? {
                          split: p.payoutSplit,
                          mode: p.payoutMode,
                          ...(p.payoutOnUncoverable
                              ? { onUncoverable: p.payoutOnUncoverable }
                              : {}),
                      }
                    : undefined;
            return {
                id: p.id,
                name: p.name,
                brokers: allow.get(p.id) ?? [],
                ...(payout ? { payout } : {}),
                phases: (byProduct.get(p.id) ?? [])
                    .sort((a, b) => a.idx - b.idx)
                    .map((ph) => ({
                        name: ph.name,
                        kind: ph.kind,
                        balance: ph.balance,
                        ...(ph.fee != null ? { fee: ph.fee } : {}),
                        ruleset: {
                            profitTarget: ph.profitTarget,
                            maxDrawdown: ph.maxDrawdown,
                            dailyDrawdown: ph.dailyDrawdown,
                            minTradingDays: ph.minTradingDays,
                            ...(ph.maxWarnings != null
                                ? { maxWarnings: ph.maxWarnings }
                                : {}),
                            ...(ph.consistency
                                ? { consistency: ph.consistency }
                                : {}),
                            ...(ph.weekend ? { weekend: ph.weekend } : {}),
                            ...(ph.maxLot ? { maxLot: ph.maxLot } : {}),
                        },
                    })),
            };
        }),
    });
}

export async function loadFirm(db: Db, id: string): Promise<FirmConfig> {
    const [row] = await db
        .select()
        .from(firms)
        .where(eq(firms.id, id))
        .limit(1);
    if (!row) throw new Error(`firm ${id} not found`);
    const [brokerRows, productRows, pbRows, phaseRows] = await Promise.all([
        db.select().from(brokers),
        db.select().from(products),
        db.select().from(productBrokers),
        db.select().from(phases),
    ]);
    return assembleFirm({
        firm: row,
        brokers: brokerRows,
        products: productRows,
        productBrokers: pbRows,
        phases: phaseRows,
    });
}

export async function loadLiveFirm(db: Db): Promise<FirmConfig> {
    const rows = await db.select({ id: firms.id }).from(firms);
    if (rows.length !== 1) {
        throw new Error(`expected 1 firm, got ${rows.length}`);
    }
    return loadFirm(db, rows[0].id);
}

export async function usedIds(
    db: Db,
): Promise<{ products: string[]; brokers: string[] }> {
    const [acc, pay] = await Promise.all([
        db
            .select({
                productId: tradingAccounts.productId,
                brokerId: tradingAccounts.brokerId,
            })
            .from(tradingAccounts),
        db
            .select({
                productId: payments.productId,
                brokerId: payments.brokerId,
            })
            .from(payments),
    ]);
    return {
        products: [...new Set([...acc, ...pay].map((r) => r.productId))],
        brokers: [...new Set([...acc, ...pay].map((r) => r.brokerId))],
    };
}

export async function replaceFirm(db: Db, cfg: FirmConfig): Promise<void> {
    await db.transaction(async (tx) => {
        await tx
            .insert(firms)
            .values({
                id: cfg.id,
                name: cfg.name,
                dailyCloseTz: cfg.dailyClose.tz,
                dailyCloseTime: cfg.dailyClose.time,
                modulesAffiliates: cfg.modules.affiliates,
                modulesKyc: cfg.modules.kyc.enabled,
                modulesKycGate: cfg.modules.kyc.gate,
                modulesMultiBrand: cfg.modules.multiBrand,
                checkoutProvider: cfg.checkout.provider,
                checkoutCurrency: cfg.checkout.currency,
                payoutOnUncoverable: cfg.payout.onUncoverable,
            })
            .onConflictDoUpdate({
                target: firms.id,
                set: {
                    name: cfg.name,
                    dailyCloseTz: cfg.dailyClose.tz,
                    dailyCloseTime: cfg.dailyClose.time,
                    modulesAffiliates: cfg.modules.affiliates,
                    modulesKyc: cfg.modules.kyc.enabled,
                    modulesKycGate: cfg.modules.kyc.gate,
                    modulesMultiBrand: cfg.modules.multiBrand,
                    checkoutProvider: cfg.checkout.provider,
                    checkoutCurrency: cfg.checkout.currency,
                    payoutOnUncoverable: cfg.payout.onUncoverable,
                },
            });
        await tx.delete(phases);
        await tx.delete(productBrokers);
        await tx.delete(products);
        await tx.delete(brokers);
        if (cfg.brokers.length) {
            await tx.insert(brokers).values(
                cfg.brokers.map((br) => ({
                    id: br.id,
                    name: br.name,
                    bridgeProvider: br.bridge.provider,
                    bridgeUrl: br.bridge.url ?? null,
                })),
            );
        }
        if (cfg.products.length) {
            await tx.insert(products).values(
                cfg.products.map((p) => ({
                    id: p.id,
                    name: p.name,
                    payoutSplit: p.payout?.split ?? null,
                    payoutMode: p.payout?.mode ?? null,
                    payoutOnUncoverable: p.payout?.onUncoverable ?? null,
                })),
            );
            const pb = cfg.products.flatMap((p) =>
                p.brokers.map((brokerId) => ({
                    productId: p.id,
                    brokerId,
                })),
            );
            if (pb.length) await tx.insert(productBrokers).values(pb);
            await tx.insert(phases).values(
                cfg.products.flatMap((p) =>
                    p.phases.map((ph, idx) => ({
                        productId: p.id,
                        idx,
                        name: ph.name,
                        kind: ph.kind,
                        balance: ph.balance,
                        fee: ph.fee ?? null,
                        profitTarget: ph.ruleset.profitTarget,
                        maxDrawdown: ph.ruleset.maxDrawdown,
                        dailyDrawdown: ph.ruleset.dailyDrawdown,
                        minTradingDays: ph.ruleset.minTradingDays,
                        maxWarnings: ph.ruleset.maxWarnings ?? null,
                        consistency: ph.ruleset.consistency ?? null,
                        weekend: ph.ruleset.weekend ?? null,
                        maxLot: ph.ruleset.maxLot ?? null,
                    })),
                ),
            );
        }
        await tx.execute(sql`notify firm_config`);
    });
}

export async function ensureFirm(
    db: Db,
    fromEnv?: string,
): Promise<FirmConfig> {
    const rows = await db.select({ id: firms.id }).from(firms);
    if (rows.length > 1) {
        throw new Error(`expected 1 firm, got ${rows.length}`);
    }
    const cfg = loadFirmFromPath(defaultFirmPath(fromEnv));
    if (rows.length === 1) {
        const [product] = await db
            .select({ id: products.id })
            .from(products)
            .limit(1);
        if (product) {
            // ponytail: leftover pre-ADR 0005/0009 rows; drop when all DBs reseeded
            await db.execute(sql`
                UPDATE phases SET
                    profit_target = profit_target / balance,
                    max_drawdown = max_drawdown / balance,
                    daily_drawdown = daily_drawdown / balance
                WHERE balance > 0 AND (
                    profit_target > 1 OR max_drawdown > 1 OR daily_drawdown > 1
                )
            `);
            await db.execute(sql`
                UPDATE trading_accounts ta SET broker_id = COALESCE(
                    (
                        SELECT pb.broker_id FROM product_brokers pb
                        WHERE pb.firm_id = ta.firm_id AND pb.product_id = ta.product_id
                        LIMIT 1
                    ),
                    (SELECT b.id FROM brokers b WHERE b.firm_id = ta.firm_id LIMIT 1)
                )
                WHERE ta.broker_id = ''
            `);
            await db.execute(sql`
                UPDATE payments p SET broker_id = COALESCE(
                    (
                        SELECT pb.broker_id FROM product_brokers pb
                        WHERE pb.firm_id = p.firm_id AND pb.product_id = p.product_id
                        LIMIT 1
                    ),
                    (SELECT b.id FROM brokers b WHERE b.firm_id = p.firm_id LIMIT 1)
                )
                WHERE p.broker_id = ''
            `);
            return loadFirm(db, rows[0].id);
        }
    }
    await replaceFirm(db, cfg);
    return cfg;
}

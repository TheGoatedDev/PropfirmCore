import { readFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import {
    type BrokerWrite,
    type FirmConfig,
    type FirmConfigWrite,
    ingestKeyEnvName,
    loadFirmConfig,
    type ProductWrite,
    parseFirmConfig,
} from "@propfirmcore/config";
import { eq, notInArray, sql } from "drizzle-orm";
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
    next: FirmConfigWrite,
    used: { products: string[]; brokers: string[] },
): string[] {
    const p = new Set(
        next.products
            .map((x) => x.id)
            .filter((id): id is string => Boolean(id)),
    );
    const b = new Set(
        next.brokers.map((x) => x.id).filter((id): id is string => Boolean(id)),
    );
    return [
        ...used.products
            .filter((id) => !p.has(id))
            .map((id) => `product ${id}`),
        ...used.brokers.filter((id) => !b.has(id)).map((id) => `broker ${id}`),
    ];
}

export function missingIngestKeys(
    next: FirmConfigWrite,
    env: NodeJS.Dict<string> = process.env,
): string[] {
    if (env.INGEST_API_KEY) return [];
    const names = new Set<string>();
    for (const br of next.brokers) {
        if (!br.id) {
            names.add("INGEST_API_KEY");
            continue;
        }
        const name = ingestKeyEnvName(br.id);
        if (!env[name]) names.add(name);
    }
    return [...names];
}

export function unknownIds(
    next: FirmConfigWrite,
    current: { brokers: { id: string }[]; products: { id: string }[] },
): string[] {
    const b = new Set(current.brokers.map((x) => x.id));
    const p = new Set(current.products.map((x) => x.id));
    return [
        ...next.brokers
            .filter((x) => x.id && !b.has(x.id))
            .map((x) => `broker ${x.id}`),
        ...next.products
            .filter((x) => x.id && !p.has(x.id))
            .map((x) => `product ${x.id}`),
    ];
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

function brokerValues(br: BrokerWrite) {
    return {
        name: br.name,
        bridgeProvider: br.bridge.provider,
        bridgeUrl: br.bridge.url ?? null,
    };
}

function productValues(p: ProductWrite) {
    return {
        name: p.name,
        payoutSplit: p.payout?.split ?? null,
        payoutMode: p.payout?.mode ?? null,
        payoutOnUncoverable: p.payout?.onUncoverable ?? null,
    };
}

export async function replaceFirm(db: Db, cfg: FirmConfigWrite): Promise<void> {
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
        const existingBrokers = new Set(
            (await tx.select({ id: brokers.id }).from(brokers)).map(
                (r) => r.id,
            ),
        );
        const existingProducts = new Set(
            (await tx.select({ id: products.id }).from(products)).map(
                (r) => r.id,
            ),
        );
        const keepBrokerIds: string[] = [];
        for (const br of cfg.brokers) {
            const row = brokerValues(br);
            if (br.id && existingBrokers.has(br.id)) {
                await tx.update(brokers).set(row).where(eq(brokers.id, br.id));
                keepBrokerIds.push(br.id);
            } else if (br.id) {
                await tx.insert(brokers).values({ id: br.id, ...row });
                keepBrokerIds.push(br.id);
            } else {
                const [inserted] = await tx
                    .insert(brokers)
                    .values(row)
                    .returning({ id: brokers.id });
                if (!inserted) throw new Error("broker insert returned no id");
                keepBrokerIds.push(inserted.id);
            }
        }
        const keepProductIds: string[] = [];
        for (const p of cfg.products) {
            const row = productValues(p);
            if (p.id && existingProducts.has(p.id)) {
                await tx.update(products).set(row).where(eq(products.id, p.id));
                keepProductIds.push(p.id);
            } else if (p.id) {
                await tx.insert(products).values({ id: p.id, ...row });
                keepProductIds.push(p.id);
            } else {
                const [inserted] = await tx
                    .insert(products)
                    .values(row)
                    .returning({ id: products.id });
                if (!inserted) throw new Error("product insert returned no id");
                keepProductIds.push(inserted.id);
            }
        }
        await tx.delete(phases);
        await tx.delete(productBrokers);
        await tx
            .delete(products)
            .where(notInArray(products.id, keepProductIds));
        await tx.delete(brokers).where(notInArray(brokers.id, keepBrokerIds));
        const pb = cfg.products.flatMap((p, i) =>
            p.brokers.map((brokerId) => ({
                productId: keepProductIds[i] ?? "",
                brokerId,
            })),
        );
        if (pb.length) await tx.insert(productBrokers).values(pb);
        await tx.insert(phases).values(
            cfg.products.flatMap((p, i) =>
                p.phases.map((ph, idx) => ({
                    productId: keepProductIds[i] ?? "",
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
            return loadFirm(db, rows[0].id);
        }
    }
    await replaceFirm(db, cfg);
    return cfg;
}

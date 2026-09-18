import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
    kycGates,
    onUncoverablePolicies,
    payoutModes,
    phaseKinds,
    type Ruleset,
} from "@propfirmcore/config";
import {
    assetClasses,
    type Fill,
    fillSchema,
    fillSides,
    type Payout,
    type Position,
    payoutReasons,
    payoutStatuses,
    type Snapshot,
    type TradingAccount,
    tradingAccountSchema,
    tradingAccountStatuses,
} from "@propfirmcore/domain";
import {
    boolean,
    doublePrecision,
    integer,
    jsonb,
    pgEnum,
    pgTable,
    primaryKey,
    text,
} from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate as migrateDb } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import * as authSchema from "../auth/auth-schema.ts";
import { user } from "../auth/auth-schema.ts";

export const paymentStatuses = [
    "pending",
    "paid",
    "failed",
    "canceled",
] as const;

type Same<A, B> = [A, B] extends [B, A] ? true : { expected: A; got: B };

export const tradingAccountStatusEnum = pgEnum(
    "trading_account_status",
    tradingAccountStatuses,
);
export const assetClassEnum = pgEnum("asset_class", assetClasses);
export const fillSideEnum = pgEnum("fill_side", fillSides);
export const paymentStatusEnum = pgEnum("payment_status", paymentStatuses);
export const payoutStatusEnum = pgEnum("payout_status", payoutStatuses);
export const payoutReasonEnum = pgEnum("payout_reason", payoutReasons);
export const phaseKindEnum = pgEnum("phase_kind", phaseKinds);
export const payoutModeEnum = pgEnum("payout_mode", payoutModes);
export const onUncoverableEnum = pgEnum(
    "on_uncoverable",
    onUncoverablePolicies,
);
export const kycGateEnum = pgEnum("kyc_gate", kycGates);

export const firms = pgTable("firm", {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    dailyCloseTz: text("daily_close_tz").notNull(),
    dailyCloseTime: text("daily_close_time").notNull(),
    modulesAffiliates: boolean("modules_affiliates").notNull(),
    modulesKyc: boolean("modules_kyc").notNull(),
    modulesKycGate: kycGateEnum("modules_kyc_gate").notNull().default("payout"),
    modulesMultiBrand: boolean("modules_multi_brand").notNull(),
    checkoutProvider: text("checkout_provider").notNull(),
    checkoutCurrency: text("checkout_currency").notNull(),
    payoutOnUncoverable: onUncoverableEnum("payout_on_uncoverable").notNull(),
});

export const brokers = pgTable("brokers", {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    bridgeProvider: text("bridge_provider").notNull(),
    bridgeUrl: text("bridge_url"),
});

export const products = pgTable("products", {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    payoutSplit: doublePrecision("payout_split"),
    payoutMode: payoutModeEnum("payout_mode"),
    payoutOnUncoverable: onUncoverableEnum("payout_on_uncoverable"),
});

export const productBrokers = pgTable(
    "product_brokers",
    {
        productId: text("product_id").notNull(),
        brokerId: text("broker_id").notNull(),
    },
    (t) => [primaryKey({ columns: [t.productId, t.brokerId] })],
);

export const phases = pgTable(
    "phases",
    {
        productId: text("product_id").notNull(),
        idx: integer("idx").notNull(),
        name: text("name").notNull(),
        kind: phaseKindEnum("kind").notNull(),
        balance: doublePrecision("balance").notNull(),
        fee: doublePrecision("fee"),
        profitTarget: doublePrecision("profit_target").notNull(),
        maxDrawdown: doublePrecision("max_drawdown").notNull(),
        dailyDrawdown: doublePrecision("daily_drawdown").notNull(),
        minTradingDays: integer("min_trading_days").notNull(),
        maxWarnings: integer("max_warnings"),
        consistency: jsonb("consistency").$type<Ruleset["consistency"]>(),
        weekend: jsonb("weekend").$type<Ruleset["weekend"]>(),
        maxLot: jsonb("max_lot").$type<Ruleset["maxLot"]>(),
    },
    (t) => [primaryKey({ columns: [t.productId, t.idx] })],
);

export const tradingAccounts = pgTable("trading_accounts", {
    id: text("id").primaryKey(),
    userId: text("user_id")
        .notNull()
        .references(() => user.id),
    productId: text("product_id").notNull(),
    phaseIndex: integer("phase_index").notNull(),
    status: tradingAccountStatusEnum("status").notNull(),
    startBalance: doublePrecision("start_balance").notNull(),
    equity: doublePrecision("equity").notNull(),
    balance: doublePrecision("balance").notNull(),
    peakEquity: doublePrecision("peak_equity").notNull(),
    dailyStartEquity: doublePrecision("daily_start_equity").notNull(),
    tradingDayKey: text("trading_day_key").notNull(),
    tradingDays: jsonb("trading_days").$type<string[]>().notNull(),
    dailyPnls: jsonb("daily_pnls")
        .$type<TradingAccount["dailyPnls"]>()
        .notNull(),
    ruleset: jsonb("ruleset").$type<Ruleset>().notNull(),
    brokerId: text("broker_id").notNull(),
    brokerLogin: text("broker_login").notNull(),
    brokerPassword: text("broker_password").notNull(),
});

export const snapshots = pgTable("snapshots", {
    externalId: text("external_id").primaryKey(),
    tradingAccountId: text("trading_account_id")
        .notNull()
        .references(() => tradingAccounts.id),
    equity: doublePrecision("equity").notNull(),
    balance: doublePrecision("balance").notNull(),
    ts: text("ts").notNull(),
    positions: jsonb("positions").$type<Position[]>().notNull(),
});

export const fills = pgTable("fills", {
    externalId: text("external_id").primaryKey(),
    tradingAccountId: text("trading_account_id")
        .notNull()
        .references(() => tradingAccounts.id),
    positionId: text("position_id").notNull(),
    symbol: text("symbol").notNull(),
    class: assetClassEnum("class").notNull(),
    qty: doublePrecision("qty").notNull(),
    price: doublePrecision("price").notNull(),
    side: fillSideEnum("side").notNull(),
    ts: text("ts").notNull(),
    multiplier: doublePrecision("multiplier").notNull(),
    tickSize: doublePrecision("tick_size").notNull(),
    currency: text("currency").notNull(),
});

export const payments = pgTable("payments", {
    id: text("id").primaryKey(),
    userId: text("user_id")
        .notNull()
        .references(() => user.id),
    productId: text("product_id").notNull(),
    amount: doublePrecision("amount").notNull(),
    currency: text("currency").notNull(),
    provider: text("provider").notNull(),
    providerRef: text("provider_ref"),
    status: paymentStatusEnum("status").notNull(),
    brokerId: text("broker_id").notNull(),
    tradingAccountId: text("trading_account_id").references(
        () => tradingAccounts.id,
    ),
});

export const breachSeverities = ["warn", "flag"] as const;
export const breachSeverityEnum = pgEnum("breach_severity", breachSeverities);

export const ruleBreaches = pgTable(
    "rule_breaches",
    {
        tradingAccountId: text("trading_account_id")
            .notNull()
            .references(() => tradingAccounts.id),
        phaseIndex: integer("phase_index").notNull(),
        ruleId: text("rule_id").notNull(),
        severity: breachSeverityEnum("severity").notNull(),
        subjectId: text("subject_id").notNull(),
        positionId: text("position_id"),
        ts: text("ts").notNull(),
    },
    (t) => [
        primaryKey({
            columns: [t.tradingAccountId, t.phaseIndex, t.ruleId, t.subjectId],
        }),
    ],
);

export const payouts = pgTable("payouts", {
    id: text("id").primaryKey(),
    userId: text("user_id")
        .notNull()
        .references(() => user.id),
    tradingAccountId: text("trading_account_id")
        .notNull()
        .references(() => tradingAccounts.id),
    amount: doublePrecision("amount").notNull(),
    currency: text("currency").notNull(),
    status: payoutStatusEnum("status").notNull(),
    reason: payoutReasonEnum("reason"),
});

true satisfies Same<typeof tradingAccounts.$inferSelect, TradingAccount>;
true satisfies Same<
    typeof fills.$inferSelect,
    Fill & { tradingAccountId: string }
>;
true satisfies Same<
    typeof snapshots.$inferSelect,
    Snapshot & { tradingAccountId: string }
>;
true satisfies Same<typeof payouts.$inferSelect, Payout>;

export function createDb(url: string) {
    const sql = postgres(url);
    const db = drizzle(sql, {
        schema: {
            ...authSchema,
            firms,
            brokers,
            products,
            productBrokers,
            phases,
            tradingAccounts,
            fills,
            snapshots,
            payments,
            payouts,
            ruleBreaches,
        },
    });
    return { db, sql };
}

export type Db = ReturnType<typeof createDb>["db"];

export async function migrate(db: Db): Promise<void> {
    await migrateDb(db, {
        migrationsFolder: join(
            dirname(fileURLToPath(import.meta.url)),
            "../../drizzle",
        ),
    });
}

export function tradingAccountFromRow(
    row: typeof tradingAccounts.$inferSelect,
): TradingAccount {
    return tradingAccountSchema.parse(row);
}

export function tradingAccountToRow(
    account: TradingAccount,
): typeof tradingAccounts.$inferInsert {
    return tradingAccountSchema.parse(account);
}

export function fillToRow(
    tradingAccountId: string,
    fill: Fill,
): typeof fills.$inferInsert {
    return { tradingAccountId, ...fillSchema.parse(fill) };
}

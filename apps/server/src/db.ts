import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
    type Account,
    accountSchema,
    accountStatuses,
    assetClasses,
    type Fill,
    fillSchema,
    fillSides,
    type Position,
    type Snapshot,
} from "@propfirmcore/domain";
import {
    doublePrecision,
    integer,
    jsonb,
    pgEnum,
    pgTable,
    text,
} from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate as migrateDb } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import * as authSchema from "./auth-schema.ts";
import { user } from "./auth-schema.ts";

export const paymentStatuses = [
    "pending",
    "paid",
    "failed",
    "canceled",
] as const;

type Same<A, B> = [A, B] extends [B, A] ? true : { expected: A; got: B };

export const accountStatusEnum = pgEnum("account_status", accountStatuses);
export const assetClassEnum = pgEnum("asset_class", assetClasses);
export const fillSideEnum = pgEnum("fill_side", fillSides);
export const paymentStatusEnum = pgEnum("payment_status", paymentStatuses);

export const accounts = pgTable("accounts", {
    id: text("id").primaryKey(),
    userId: text("user_id"),
    productId: text("product_id").notNull(),
    phaseIndex: integer("phase_index").notNull(),
    status: accountStatusEnum("status").notNull(),
    startBalance: doublePrecision("start_balance").notNull(),
    equity: doublePrecision("equity").notNull(),
    balance: doublePrecision("balance").notNull(),
    peakEquity: doublePrecision("peak_equity").notNull(),
    dailyStartEquity: doublePrecision("daily_start_equity").notNull(),
    tradingDayKey: text("trading_day_key").notNull(),
    tradingDays: jsonb("trading_days").$type<string[]>().notNull(),
});

export const snapshots = pgTable("snapshots", {
    externalId: text("external_id").primaryKey(),
    accountId: text("account_id")
        .notNull()
        .references(() => accounts.id),
    equity: doublePrecision("equity").notNull(),
    balance: doublePrecision("balance").notNull(),
    ts: text("ts").notNull(),
    positions: jsonb("positions").$type<Position[]>().notNull(),
});

export const fills = pgTable("fills", {
    externalId: text("external_id").primaryKey(),
    accountId: text("account_id")
        .notNull()
        .references(() => accounts.id),
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
    accountId: text("account_id").references(() => accounts.id),
});

true satisfies Same<typeof accounts.$inferSelect, Account>;
true satisfies Same<typeof fills.$inferSelect, Fill & { accountId: string }>;
true satisfies Same<
    typeof snapshots.$inferSelect,
    Snapshot & { accountId: string }
>;

export function createDb(url: string) {
    const sql = postgres(url);
    const db = drizzle(sql, {
        schema: { ...authSchema, accounts, fills, snapshots, payments },
    });
    return { db, sql };
}

export type Db = ReturnType<typeof createDb>["db"];

export async function migrate(db: Db): Promise<void> {
    await migrateDb(db, {
        migrationsFolder: join(
            dirname(fileURLToPath(import.meta.url)),
            "../drizzle",
        ),
    });
}

export function accountFromRow(row: typeof accounts.$inferSelect): Account {
    return accountSchema.parse(row);
}

export function accountToRow(account: Account): typeof accounts.$inferInsert {
    return accountSchema.parse(account);
}

export function fillToRow(
    accountId: string,
    fill: Fill,
): typeof fills.$inferInsert {
    return { accountId, ...fillSchema.parse(fill) };
}

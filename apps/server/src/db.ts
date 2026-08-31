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

function createEnumSql(name: string, values: readonly string[]): string {
    const list = values.map((v) => `'${v.replaceAll("'", "''")}'`).join(", ");
    return `do $$ begin create type ${name} as enum (${list}); exception when duplicate_object then null; end $$`;
}

export async function migrate(sql: postgres.Sql): Promise<void> {
    await sql.unsafe(createEnumSql("account_status", accountStatuses));
    await sql.unsafe(createEnumSql("asset_class", assetClasses));
    await sql.unsafe(createEnumSql("fill_side", fillSides));
    await sql.unsafe(createEnumSql("payment_status", paymentStatuses));
    await sql`
        create table if not exists accounts (
            id text primary key,
            product_id text not null,
            phase_index integer not null,
            status account_status not null,
            start_balance double precision not null,
            equity double precision not null,
            balance double precision not null,
            peak_equity double precision not null,
            daily_start_equity double precision not null,
            trading_day_key text not null,
            trading_days jsonb not null
        )
    `;
    await sql`
        create table if not exists snapshots (
            external_id text primary key,
            account_id text not null references accounts (id),
            equity double precision not null,
            balance double precision not null,
            ts text not null,
            positions jsonb not null
        )
    `;
    await sql`
        create table if not exists fills (
            external_id text primary key,
            account_id text not null references accounts (id),
            position_id text not null,
            symbol text not null,
            class asset_class not null,
            qty double precision not null,
            price double precision not null,
            side fill_side not null,
            ts text not null,
            multiplier double precision not null,
            tick_size double precision not null,
            currency text not null
        )
    `;
    await sql`
        create table if not exists "user" (
            id text primary key,
            name text not null,
            email text not null unique,
            email_verified boolean not null default false,
            image text,
            created_at timestamp not null default now(),
            updated_at timestamp not null default now(),
            role text default 'trader',
            banned boolean default false,
            ban_reason text,
            ban_expires timestamp
        )
    `;
    await sql`
        create table if not exists session (
            id text primary key,
            expires_at timestamp not null,
            token text not null unique,
            created_at timestamp not null default now(),
            updated_at timestamp not null default now(),
            ip_address text,
            user_agent text,
            user_id text not null references "user" (id) on delete cascade,
            impersonated_by text
        )
    `;
    await sql`create index if not exists session_userId_idx on session (user_id)`;
    await sql`
        create table if not exists account (
            id text primary key,
            issuer text not null,
            account_id text not null,
            provider_id text not null,
            user_id text not null references "user" (id) on delete cascade,
            access_token text,
            refresh_token text,
            id_token text,
            access_token_expires_at timestamp,
            refresh_token_expires_at timestamp,
            scope text,
            password text,
            created_at timestamp not null default now(),
            updated_at timestamp not null default now()
        )
    `;
    await sql`create unique index if not exists account_issuer_accountId_uidx on account (issuer, account_id)`;
    await sql`create index if not exists account_userId_idx on account (user_id)`;
    await sql`
        create table if not exists verification (
            id text primary key,
            identifier text not null,
            value text not null,
            expires_at timestamp not null,
            created_at timestamp not null default now(),
            updated_at timestamp not null default now()
        )
    `;
    await sql`create index if not exists verification_identifier_idx on verification (identifier)`;
    await sql`
        create table if not exists payments (
            id text primary key,
            user_id text not null references "user" (id),
            product_id text not null,
            amount double precision not null,
            currency text not null,
            provider text not null,
            provider_ref text,
            status payment_status not null,
            account_id text references accounts (id)
        )
    `;
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

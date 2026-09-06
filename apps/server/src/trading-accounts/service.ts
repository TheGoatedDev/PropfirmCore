import {
    forceFail,
    forcePass,
    type TradingAccount,
} from "@propfirmcore/domain";
import { and, asc, count, desc, eq, ilike, or, sql } from "drizzle-orm";
import { roleHasPermission } from "../auth/permissions.ts";
import {
    type Db,
    tradingAccountFromRow,
    tradingAccounts,
    tradingAccountToRow,
} from "../db/db.ts";
import { log } from "../logger.ts";

const sortColumns = {
    id: tradingAccounts.id,
    status: tradingAccounts.status,
    equity: tradingAccounts.equity,
    productId: tradingAccounts.productId,
    userId: tradingAccounts.userId,
} as const;

export type AccountListSort = keyof typeof sortColumns;

export async function listAccounts(
    db: Db,
    input: {
        who: { id: string; role: string };
        page: number;
        pageSize: number;
        q?: string;
        sort?: AccountListSort;
        order: "asc" | "desc";
    },
): Promise<{ items: TradingAccount[]; total: number }> {
    const parts = [];
    if (!roleHasPermission(input.who.role, "tradingAccount", "list")) {
        parts.push(eq(tradingAccounts.userId, input.who.id));
    }
    const q = input.q?.trim();
    if (q) {
        const pattern = `%${q}%`;
        parts.push(
            or(
                ilike(tradingAccounts.id, pattern),
                sql`${tradingAccounts.status}::text ilike ${pattern}`,
            ),
        );
    }
    const where = parts.length ? and(...parts) : undefined;
    const col = sortColumns[input.sort ?? "id"];
    const order = input.order === "desc" ? desc(col) : asc(col);
    const [rows, totals] = await Promise.all([
        db
            .select()
            .from(tradingAccounts)
            .where(where)
            .orderBy(order)
            .limit(input.pageSize)
            .offset((input.page - 1) * input.pageSize),
        db.select({ n: count() }).from(tradingAccounts).where(where),
    ]);
    return {
        items: rows.map(tradingAccountFromRow),
        total: totals[0]?.n ?? 0,
    };
}

export async function getById(
    db: Db,
    id: string,
): Promise<TradingAccount | null> {
    const rows = await db
        .select()
        .from(tradingAccounts)
        .where(eq(tradingAccounts.id, id))
        .limit(1);
    return rows[0] ? tradingAccountFromRow(rows[0]) : null;
}

export async function forceFailAccount(
    db: Db,
    id: string,
): Promise<TradingAccount | null> {
    const account = await getById(db, id);
    if (!account) return null;
    const next = forceFail(account);
    await db
        .update(tradingAccounts)
        .set(tradingAccountToRow(next))
        .where(eq(tradingAccounts.id, id));
    log.info({ accountId: id, status: next.status });
    return next;
}

export async function forcePassAccount(
    db: Db,
    id: string,
): Promise<TradingAccount | null> {
    const account = await getById(db, id);
    if (!account) return null;
    const next = forcePass(account);
    await db
        .update(tradingAccounts)
        .set(tradingAccountToRow(next))
        .where(eq(tradingAccounts.id, id));
    log.info({ accountId: id, status: next.status });
    return next;
}

import {
    forceFail,
    forcePass,
    type TradingAccount,
} from "@propfirmcore/domain";
import { eq } from "drizzle-orm";
import {
    type Db,
    tradingAccountFromRow,
    tradingAccounts,
    tradingAccountToRow,
} from "../db/db.ts";

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
    return next;
}

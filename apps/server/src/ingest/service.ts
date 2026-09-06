import type { FirmConfig } from "@propfirmcore/config";
import {
    applyFills,
    applySnapshot,
    type Fill,
    type Snapshot,
    type TradingAccount,
} from "@propfirmcore/domain";
import { eq, inArray } from "drizzle-orm";
import {
    type Db,
    fills,
    fillToRow,
    snapshots,
    tradingAccountFromRow,
    tradingAccounts,
    tradingAccountToRow,
} from "../db/db.ts";
import { log } from "../logger.ts";

function productOrNull(firm: FirmConfig, productId: string) {
    return firm.products.find((p) => p.id === productId);
}

function logSettle(account: TradingAccount, next: TradingAccount) {
    if (
        next.status === account.status &&
        next.phaseIndex === account.phaseIndex
    ) {
        return;
    }
    log.info({
        accountId: account.id,
        from: { status: account.status, phaseIndex: account.phaseIndex },
        to: { status: next.status, phaseIndex: next.phaseIndex },
    });
}

export async function ingestSnapshot(
    db: Db,
    firm: FirmConfig,
    id: string,
    body: Snapshot,
): Promise<
    | { ok: true; account: TradingAccount }
    | { ok: false; error: "not found" | "unknown product" }
> {
    return db.transaction(async (tx) => {
        const rows = await tx
            .select()
            .from(tradingAccounts)
            .where(eq(tradingAccounts.id, id))
            .for("update")
            .limit(1);
        const row = rows[0];
        if (!row) return { ok: false, error: "not found" };
        const account = tradingAccountFromRow(row);
        const seen = await tx
            .select({ id: snapshots.externalId })
            .from(snapshots)
            .where(eq(snapshots.externalId, body.externalId))
            .limit(1);
        if (seen[0]) return { ok: true, account };
        const product = productOrNull(firm, account.productId);
        if (!product) return { ok: false, error: "unknown product" };
        const next = applySnapshot(account, body, product, firm.dailyClose);
        await tx.insert(snapshots).values({
            externalId: body.externalId,
            tradingAccountId: id,
            equity: body.equity,
            balance: body.balance,
            ts: body.ts,
            positions: body.positions,
        });
        await tx
            .update(tradingAccounts)
            .set(tradingAccountToRow(next))
            .where(eq(tradingAccounts.id, id));
        logSettle(account, next);
        return { ok: true, account: next };
    });
}

export async function ingestFills(
    db: Db,
    firm: FirmConfig,
    id: string,
    incoming: Fill[],
): Promise<
    | { ok: true; account: TradingAccount }
    | { ok: false; error: "not found" | "unknown product" }
> {
    return db.transaction(async (tx) => {
        const rows = await tx
            .select()
            .from(tradingAccounts)
            .where(eq(tradingAccounts.id, id))
            .for("update")
            .limit(1);
        const row = rows[0];
        if (!row) return { ok: false, error: "not found" };
        const account = tradingAccountFromRow(row);
        const ids = incoming.map((f) => f.externalId);
        const existing = await tx
            .select({ id: fills.externalId })
            .from(fills)
            .where(inArray(fills.externalId, ids));
        const seen = new Set(existing.map((r) => r.id));
        const newFills = incoming.filter((f) => !seen.has(f.externalId));
        if (newFills.length === 0) return { ok: true, account };
        const product = productOrNull(firm, account.productId);
        if (!product) return { ok: false, error: "unknown product" };
        const next = applyFills(
            account,
            newFills,
            product,
            firm.dailyClose,
            newFills[newFills.length - 1].ts,
        );
        await tx.insert(fills).values(newFills.map((f) => fillToRow(id, f)));
        await tx
            .update(tradingAccounts)
            .set(tradingAccountToRow(next))
            .where(eq(tradingAccounts.id, id));
        logSettle(account, next);
        return { ok: true, account: next };
    });
}

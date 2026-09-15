import type { FirmConfig } from "@propfirmcore/config";
import {
    applyFills,
    applySnapshot,
    type ExistingBreach,
    type Fill,
    fillsFrozen,
    type RuleBreach,
    type SettleClose,
    type Snapshot,
    type TradingAccount,
} from "@propfirmcore/domain";
import { and, eq, inArray } from "drizzle-orm";
import {
    type Db,
    fills,
    fillToRow,
    payouts,
    ruleBreaches,
    snapshots,
    tradingAccountFromRow,
    tradingAccounts,
    tradingAccountToRow,
} from "../db/db.ts";
import { kycBlocksFundedEntry, kycVerifiedOf } from "../kyc.ts";
import { log } from "../logger.ts";
import { getBridge } from "../payouts/adapters.ts";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

async function loadExisting(
    tx: Tx,
    accountId: string,
    phaseIndex: number,
): Promise<ExistingBreach[]> {
    const rows = await tx
        .select()
        .from(ruleBreaches)
        .where(
            and(
                eq(ruleBreaches.tradingAccountId, accountId),
                eq(ruleBreaches.phaseIndex, phaseIndex),
            ),
        );
    return rows.map((r) => ({
        ruleId: r.ruleId,
        subjectId: r.subjectId,
        severity: r.severity,
    }));
}

async function persistBreaches(
    tx: Tx,
    accountId: string,
    phaseIndex: number,
    ts: string,
    breaches: RuleBreach[],
): Promise<void> {
    if (breaches.length === 0) return;
    await tx
        .insert(ruleBreaches)
        .values(
            breaches.map((b) => ({
                tradingAccountId: accountId,
                phaseIndex,
                ruleId: b.ruleId,
                severity: b.severity,
                subjectId: b.subjectId,
                positionId: b.positionId ?? null,
                ts,
            })),
        )
        .onConflictDoNothing();
}

async function runCloses(
    firm: FirmConfig,
    account: TradingAccount,
    closes: SettleClose[],
): Promise<void> {
    if (closes.length === 0) return;
    const bridge = getBridge(firm, account.brokerId);
    if (!bridge) return;
    const seen = new Set<string>();
    for (const c of closes) {
        if (seen.has(c.positionId)) continue;
        seen.add(c.positionId);
        await bridge.closePosition(account, c.positionId);
    }
}

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
    const out = await db.transaction(async (tx) => {
        const rows = await tx
            .select()
            .from(tradingAccounts)
            .where(eq(tradingAccounts.id, id))
            .for("update")
            .limit(1);
        const row = rows[0];
        if (!row) return { ok: false as const, error: "not found" as const };
        const account = tradingAccountFromRow(row);
        const seen = await tx
            .select({ id: snapshots.externalId })
            .from(snapshots)
            .where(eq(snapshots.externalId, body.externalId))
            .limit(1);
        if (seen[0]) return { ok: true as const, account, closes: [] };
        const product = productOrNull(firm, account.productId);
        if (!product) {
            return { ok: false as const, error: "unknown product" as const };
        }
        const existing = await loadExisting(tx, id, account.phaseIndex);
        const mayAdvance = !kycBlocksFundedEntry(
            firm,
            await kycVerifiedOf(tx, account.userId),
        );
        const settled = applySnapshot(
            account,
            body,
            product,
            firm.dailyClose,
            existing,
            mayAdvance,
        );
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
            .set(tradingAccountToRow(settled.account))
            .where(eq(tradingAccounts.id, id));
        await persistBreaches(
            tx,
            id,
            account.phaseIndex,
            body.ts,
            settled.breaches,
        );
        logSettle(account, settled.account);
        return {
            ok: true as const,
            account: settled.account,
            closes: settled.closes,
        };
    });
    if (out.ok) {
        await runCloses(firm, out.account, out.closes);
        return { ok: true as const, account: out.account };
    }
    return out;
}

export async function ingestFills(
    db: Db,
    firm: FirmConfig,
    id: string,
    incoming: Fill[],
): Promise<
    | { ok: true; account: TradingAccount }
    | { ok: false; error: "not found" | "unknown product" | "frozen" }
> {
    const out = await db.transaction(async (tx) => {
        const rows = await tx
            .select()
            .from(tradingAccounts)
            .where(eq(tradingAccounts.id, id))
            .for("update")
            .limit(1);
        const row = rows[0];
        if (!row) return { ok: false as const, error: "not found" as const };
        const account = tradingAccountFromRow(row);
        const ids = incoming.map((f) => f.externalId);
        const seenRows = await tx
            .select({ id: fills.externalId })
            .from(fills)
            .where(inArray(fills.externalId, ids));
        const seen = new Set(seenRows.map((r) => r.id));
        const newFills = incoming.filter((f) => !seen.has(f.externalId));
        if (newFills.length === 0) {
            return { ok: true as const, account, closes: [] };
        }
        const product = productOrNull(firm, account.productId);
        if (!product) {
            return { ok: false as const, error: "unknown product" as const };
        }
        const open = await tx
            .select()
            .from(payouts)
            .where(eq(payouts.tradingAccountId, id));
        if (fillsFrozen(product.payout?.mode, open)) {
            return { ok: false as const, error: "frozen" as const };
        }
        const prior = await loadExisting(tx, id, account.phaseIndex);
        const mayAdvance = !kycBlocksFundedEntry(
            firm,
            await kycVerifiedOf(tx, account.userId),
        );
        const settled = applyFills(
            account,
            newFills,
            product,
            firm.dailyClose,
            newFills[newFills.length - 1].ts,
            prior,
            mayAdvance,
        );
        await tx.insert(fills).values(newFills.map((f) => fillToRow(id, f)));
        await tx
            .update(tradingAccounts)
            .set(tradingAccountToRow(settled.account))
            .where(eq(tradingAccounts.id, id));
        await persistBreaches(
            tx,
            id,
            account.phaseIndex,
            newFills[newFills.length - 1].ts,
            settled.breaches,
        );
        logSettle(account, settled.account);
        return {
            ok: true as const,
            account: settled.account,
            closes: settled.closes,
        };
    });
    if (out.ok) {
        await runCloses(firm, out.account, out.closes);
        return { ok: true as const, account: out.account };
    }
    return out;
}

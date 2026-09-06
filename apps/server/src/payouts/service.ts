import { type FirmConfig, onUncoverableFor } from "@propfirmcore/config";
import {
    availablePayout,
    onFundedPhase,
    type Payout,
    reservedAmount,
    type TradingAccount,
} from "@propfirmcore/domain";
import { eq } from "drizzle-orm";
import {
    type Db,
    payouts,
    tradingAccountFromRow,
    tradingAccounts,
    tradingAccountToRow,
} from "../db/db.ts";
import { getBridge } from "./adapters.ts";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type Exec = Db | Tx;

export function productPayout(firm: FirmConfig, productId: string) {
    return firm.products.find((p) => p.id === productId)?.payout;
}

type Ok = {
    ok: true;
    payout: Payout;
    tradingAccount: TradingAccount | null;
};
type Err = { ok: false; error: string };

async function loadAccount(db: Exec, id: string, lock = false) {
    const rows = lock
        ? await db
              .select()
              .from(tradingAccounts)
              .where(eq(tradingAccounts.id, id))
              .for("update")
              .limit(1)
        : await db
              .select()
              .from(tradingAccounts)
              .where(eq(tradingAccounts.id, id))
              .limit(1);
    return rows[0] ? tradingAccountFromRow(rows[0]) : null;
}

async function lockPayout(db: Exec, id: string) {
    const rows = await db
        .select()
        .from(payouts)
        .where(eq(payouts.id, id))
        .for("update")
        .limit(1);
    return rows[0];
}

async function loadOpen(db: Exec, tradingAccountId: string) {
    return db
        .select()
        .from(payouts)
        .where(eq(payouts.tradingAccountId, tradingAccountId));
}

function availableFor(
    account: TradingAccount,
    firm: FirmConfig,
    open: Payout[],
    exceptId?: string,
) {
    const spec = productPayout(firm, account.productId);
    if (!spec) return 0;
    return availablePayout(account, spec.split, reservedAmount(open, exceptId));
}

export async function requestPayout(
    db: Db,
    firm: FirmConfig,
    input: { userId: string; tradingAccountId: string; amount: number },
): Promise<Ok | Err> {
    const account = await loadAccount(db, input.tradingAccountId);
    if (!account) return { ok: false, error: "not found" };
    if (account.userId !== input.userId)
        return { ok: false, error: "forbidden" };
    const product = firm.products.find((p) => p.id === account.productId);
    if (
        !product ||
        account.status !== "active" ||
        !onFundedPhase(account, product)
    ) {
        return { ok: false, error: "not funded" };
    }
    const spec = productPayout(firm, account.productId);
    if (!spec) return { ok: false, error: "not funded" };
    const open = await loadOpen(db, account.id);
    const available = availableFor(account, firm, open);
    if (input.amount > available)
        return { ok: false, error: "amount too high" };
    const payout: Payout = {
        id: crypto.randomUUID(),
        userId: account.userId,
        tradingAccountId: account.id,
        amount: input.amount,
        currency: firm.checkout.currency,
        status: "pending",
        reason: null,
    };
    await db.insert(payouts).values(payout);
    return { ok: true, payout, tradingAccount: account };
}

export async function approvePayout(
    db: Db,
    firm: FirmConfig,
    payoutId: string,
): Promise<Ok | Err> {
    const bridge = getBridge(firm.bridge);
    if (!bridge) return { ok: false, error: "unknown bridge" };
    // ponytail: row lock held during bridge HTTP, outbox/NAK if payout volume hurts
    return db.transaction(async (tx) => {
        const payout = await lockPayout(tx, payoutId);
        if (!payout) return { ok: false, error: "not found" };
        if (payout.status !== "pending")
            return { ok: false, error: "not pending" };
        const account = await loadAccount(tx, payout.tradingAccountId, true);
        if (!account) return { ok: false, error: "not found" };
        const product = firm.products.find((p) => p.id === account.productId);
        if (!product) return { ok: false, error: "unknown product" };
        const open = await loadOpen(tx, account.id);
        const available = availableFor(account, firm, open, payout.id);
        if (payout.amount > available) {
            if (onUncoverableFor(firm, product) === "autoReject") {
                const rejected: Payout = {
                    ...payout,
                    status: "rejected",
                    reason: "uncoverable",
                };
                await tx
                    .update(payouts)
                    .set({ status: "rejected", reason: "uncoverable" })
                    .where(eq(payouts.id, payoutId));
                return { ok: true, payout: rejected, tradingAccount: account };
            }
            return { ok: false, error: "uncoverable" };
        }
        let nextAccount: TradingAccount;
        try {
            nextAccount = await bridge.withdraw(account, payout.amount);
        } catch {
            return { ok: false, error: "bridge failed" };
        }
        const nextPayout: Payout = {
            ...payout,
            status: "approved",
            reason: null,
        };
        await tx
            .update(payouts)
            .set({ status: "approved", reason: null })
            .where(eq(payouts.id, payoutId));
        await tx
            .update(tradingAccounts)
            .set(tradingAccountToRow(nextAccount))
            .where(eq(tradingAccounts.id, account.id));
        return { ok: true, payout: nextPayout, tradingAccount: nextAccount };
    });
}

export async function rejectPayout(
    db: Db,
    firm: FirmConfig,
    payoutId: string,
): Promise<Ok | Err> {
    // ponytail: row lock held during bridge HTTP, outbox/NAK if payout volume hurts
    return db.transaction(async (tx) => {
        const payout = await lockPayout(tx, payoutId);
        if (!payout) return { ok: false, error: "not found" };
        if (payout.status === "paid")
            return { ok: false, error: "already paid" };
        if (payout.status === "rejected") {
            const account = await loadAccount(tx, payout.tradingAccountId);
            return { ok: true, payout, tradingAccount: account };
        }
        if (payout.status === "pending") {
            const next: Payout = {
                ...payout,
                status: "rejected",
                reason: "admin",
            };
            await tx
                .update(payouts)
                .set({ status: "rejected", reason: "admin" })
                .where(eq(payouts.id, payoutId));
            const account = await loadAccount(tx, payout.tradingAccountId);
            return { ok: true, payout: next, tradingAccount: account };
        }
        const account = await loadAccount(tx, payout.tradingAccountId, true);
        if (!account) return { ok: false, error: "not found" };
        const bridge = getBridge(firm.bridge);
        if (!bridge) return { ok: false, error: "unknown bridge" };
        let nextAccount: TradingAccount;
        try {
            nextAccount = await bridge.deposit(account, payout.amount);
        } catch {
            return { ok: false, error: "bridge failed" };
        }
        const next: Payout = { ...payout, status: "rejected", reason: "admin" };
        await tx
            .update(payouts)
            .set({ status: "rejected", reason: "admin" })
            .where(eq(payouts.id, payoutId));
        await tx
            .update(tradingAccounts)
            .set(tradingAccountToRow(nextAccount))
            .where(eq(tradingAccounts.id, account.id));
        return { ok: true, payout: next, tradingAccount: nextAccount };
    });
}

export async function markPayoutPaid(
    db: Db,
    payoutId: string,
): Promise<Ok | Err> {
    const rows = await db
        .select()
        .from(payouts)
        .where(eq(payouts.id, payoutId))
        .limit(1);
    const payout = rows[0];
    if (!payout) return { ok: false, error: "not found" };
    if (payout.status === "paid") {
        const account = await loadAccount(db, payout.tradingAccountId);
        return { ok: true, payout, tradingAccount: account };
    }
    if (payout.status !== "approved")
        return { ok: false, error: "not approved" };
    const next: Payout = { ...payout, status: "paid" };
    await db
        .update(payouts)
        .set({ status: "paid" })
        .where(eq(payouts.id, payoutId));
    const account = await loadAccount(db, payout.tradingAccountId);
    return { ok: true, payout: next, tradingAccount: account };
}

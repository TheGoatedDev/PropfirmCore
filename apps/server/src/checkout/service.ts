import type { FirmConfig } from "@propfirmcore/config";
import { openTradingAccount } from "@propfirmcore/domain";
import { eq } from "drizzle-orm";
import {
    type Db,
    payments,
    tradingAccountFromRow,
    tradingAccounts,
    tradingAccountToRow,
} from "../db/db.ts";
import { getAdapter } from "./adapters.ts";

export function productFee(firm: FirmConfig, productId: string): number | null {
    const product = firm.products.find((p) => p.id === productId);
    if (!product) return null;
    return product.phases[0]?.fee ?? 0;
}

export async function completePayment(
    db: Db,
    firm: FirmConfig,
    paymentId: string,
) {
    const rows = await db
        .select()
        .from(payments)
        .where(eq(payments.id, paymentId))
        .limit(1);
    const payment = rows[0];
    if (!payment) return { ok: false as const, error: "not found" };
    if (payment.status === "paid" && payment.tradingAccountId) {
        const acc = await db
            .select()
            .from(tradingAccounts)
            .where(eq(tradingAccounts.id, payment.tradingAccountId))
            .limit(1);
        return {
            ok: true as const,
            payment,
            tradingAccount: acc[0] ? tradingAccountFromRow(acc[0]) : null,
        };
    }
    if (payment.status !== "pending") {
        return { ok: false as const, error: "not pending" };
    }
    const product = firm.products.find((p) => p.id === payment.productId);
    if (!product) return { ok: false as const, error: "unknown product" };
    const account = openTradingAccount(
        crypto.randomUUID(),
        product,
        firm.dailyClose,
        new Date().toISOString(),
        payment.userId,
    );
    await db.transaction(async (tx) => {
        await tx.insert(tradingAccounts).values(tradingAccountToRow(account));
        await tx
            .update(payments)
            .set({ status: "paid", tradingAccountId: account.id })
            .where(eq(payments.id, paymentId));
    });
    return {
        ok: true as const,
        payment: {
            ...payment,
            status: "paid" as const,
            tradingAccountId: account.id,
        },
        tradingAccount: account,
    };
}

export async function startCheckout(
    db: Db,
    firm: FirmConfig,
    input: { userId: string; productId: string },
) {
    const fee = productFee(firm, input.productId);
    if (fee === null) return { ok: false as const, error: "unknown product" };
    const provider = firm.checkout.provider;
    const adapter = getAdapter(provider);
    if (!adapter) return { ok: false as const, error: "unknown provider" };
    const paymentId = crypto.randomUUID();
    await db.insert(payments).values({
        id: paymentId,
        userId: input.userId,
        productId: input.productId,
        amount: fee,
        currency: firm.checkout.currency,
        provider,
        status: "pending",
    });
    if (fee === 0) {
        const done = await completePayment(db, firm, paymentId);
        if (!done.ok) return done;
        return { ...done, redirectUrl: null };
    }
    const session = await adapter.create({
        paymentId,
        userId: input.userId,
        productId: input.productId,
        amount: fee,
        currency: firm.checkout.currency,
    });
    if (session.providerRef) {
        await db
            .update(payments)
            .set({ providerRef: session.providerRef })
            .where(eq(payments.id, paymentId));
    }
    const rows = await db
        .select()
        .from(payments)
        .where(eq(payments.id, paymentId))
        .limit(1);
    return {
        ok: true as const,
        payment: rows[0],
        tradingAccount: null,
        redirectUrl: session.redirectUrl,
    };
}

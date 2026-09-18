import type { FirmConfig } from "@propfirmcore/config";
import { openTradingAccount } from "@propfirmcore/domain";
import { eq } from "drizzle-orm";
import { DateTime } from "luxon";
import {
    type Db,
    payments,
    tradingAccountFromRow,
    tradingAccounts,
    tradingAccountToRow,
} from "../db/db.ts";
import { kycBlocksInstantFunded, kycVerifiedOf } from "../kyc.ts";
import { log } from "../logger.ts";
import { getBridge } from "../payouts/adapters.ts";
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
    if (
        kycBlocksInstantFunded(
            firm,
            await kycVerifiedOf(db, payment.userId),
            product,
        )
    ) {
        return { ok: false as const, error: "kyc required" };
    }
    const now = DateTime.utc().toISO();
    if (!now) throw new Error("bad now");
    const bridge = getBridge(firm, payment.brokerId);
    if (!bridge) return { ok: false as const, error: "unknown bridge" };
    const account = openTradingAccount(
        crypto.randomUUID(),
        product,
        firm.dailyClose,
        now,
        payment.userId,
        payment.brokerId,
    );
    let creds: { login: string; password: string };
    try {
        creds = await bridge.provision(account, account.startBalance);
    } catch (err) {
        log.error({ err, paymentId, brokerId: payment.brokerId });
        return { ok: false as const, error: "bridge failed" };
    }
    const opened = {
        ...account,
        brokerLogin: creds.login,
        brokerPassword: creds.password,
    };
    await db.transaction(async (tx) => {
        await tx.insert(tradingAccounts).values(tradingAccountToRow(opened));
        await tx
            .update(payments)
            .set({ status: "paid", tradingAccountId: opened.id })
            .where(eq(payments.id, paymentId));
    });
    log.info({
        paymentId,
        tradingAccountId: opened.id,
        userId: payment.userId,
        productId: payment.productId,
    });
    return {
        ok: true as const,
        payment: {
            ...payment,
            status: "paid" as const,
            tradingAccountId: opened.id,
        },
        tradingAccount: opened,
    };
}

export async function startCheckout(
    db: Db,
    firm: FirmConfig,
    input: { userId: string; productId: string; brokerId: string },
) {
    const fee = productFee(firm, input.productId);
    if (fee === null) return { ok: false as const, error: "unknown product" };
    const product = firm.products.find((p) => p.id === input.productId);
    if (!product?.brokers.includes(input.brokerId)) {
        return { ok: false as const, error: "unknown broker" };
    }
    if (
        kycBlocksInstantFunded(
            firm,
            await kycVerifiedOf(db, input.userId),
            product,
        )
    ) {
        return { ok: false as const, error: "kyc required" };
    }
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
        brokerId: input.brokerId,
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

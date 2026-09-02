import { z } from "zod";

export const assetClasses = ["fx", "futures", "crypto", "equity"] as const;
export const tradingAccountStatuses = ["active", "passed", "failed"] as const;
export const fillSides = ["buy", "sell"] as const;

export const assetClassSchema = z.enum(assetClasses);
export const tradingAccountStatusSchema = z.enum(tradingAccountStatuses);

export const sessionSchema = z.object({
    open: z.string().min(1),
    close: z.string().min(1),
    tz: z.string().min(1),
    days: z.array(z.number().int().min(0).max(6)),
});

export const instrumentSchema = z.object({
    symbol: z.string().min(1),
    class: assetClassSchema,
    tickSize: z.number(),
    multiplier: z.number(),
    currency: z.string().min(1),
    sessions: z.array(sessionSchema).optional(),
});

export const positionSchema = z.object({
    id: z.string().min(1),
    symbol: z.string().min(1),
    class: assetClassSchema,
    qty: z.number(),
    avgPrice: z.number(),
    openedAt: z.string().min(1),
    closedAt: z.string().min(1).nullable(),
});

export const fillSideSchema = z.enum(fillSides);

export const fillSchema = z.object({
    externalId: z.string().min(1),
    positionId: z.string().min(1),
    symbol: z.string().min(1),
    class: assetClassSchema,
    qty: z.number(),
    price: z.number(),
    side: fillSideSchema,
    ts: z.string().min(1),
    multiplier: z.number(),
    tickSize: z.number(),
    currency: z.string().min(1),
});

export const snapshotSchema = z.object({
    externalId: z.string().min(1),
    equity: z.number(),
    balance: z.number(),
    ts: z.string().min(1),
    positions: z.array(positionSchema),
});

export const payoutStatuses = [
    "pending",
    "approved",
    "rejected",
    "paid",
] as const;
export const payoutReasons = ["uncoverable", "admin"] as const;

export const payoutStatusSchema = z.enum(payoutStatuses);
export const payoutReasonSchema = z.enum(payoutReasons);

export const payoutSchema = z.object({
    id: z.string().min(1),
    userId: z.string().min(1),
    tradingAccountId: z.string().min(1),
    amount: z.number().positive(),
    currency: z.string().min(1),
    status: payoutStatusSchema,
    reason: payoutReasonSchema.nullable(),
});

export const tradingAccountSchema = z.object({
    id: z.string().min(1),
    userId: z.string().min(1),
    productId: z.string().min(1),
    phaseIndex: z.number().int(),
    status: tradingAccountStatusSchema,
    startBalance: z.number(),
    equity: z.number(),
    balance: z.number(),
    peakEquity: z.number(),
    dailyStartEquity: z.number(),
    tradingDayKey: z.string(),
    tradingDays: z.array(z.string()),
});

export type AssetClass = z.infer<typeof assetClassSchema>;
export type TradingAccountStatus = z.infer<typeof tradingAccountStatusSchema>;
export type Session = z.infer<typeof sessionSchema>;
export type Instrument = z.infer<typeof instrumentSchema>;
export type Position = z.infer<typeof positionSchema>;
export type Fill = z.infer<typeof fillSchema>;
export type Snapshot = z.infer<typeof snapshotSchema>;
export type TradingAccount = z.infer<typeof tradingAccountSchema>;
export type PayoutStatus = z.infer<typeof payoutStatusSchema>;
export type PayoutReason = z.infer<typeof payoutReasonSchema>;
export type Payout = z.infer<typeof payoutSchema>;

import { z } from "zod";

export const assetClasses = ["fx", "futures", "crypto", "equity"] as const;
export const accountStatuses = [
    "active",
    "passed",
    "failed",
    "funded",
] as const;
export const fillSides = ["buy", "sell"] as const;

export const assetClassSchema = z.enum(assetClasses);
export const accountStatusSchema = z.enum(accountStatuses);

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

export const accountSchema = z.object({
    id: z.string().min(1),
    productId: z.string().min(1),
    phaseIndex: z.number().int(),
    status: accountStatusSchema,
    startBalance: z.number(),
    equity: z.number(),
    balance: z.number(),
    peakEquity: z.number(),
    dailyStartEquity: z.number(),
    tradingDayKey: z.string(),
    tradingDays: z.array(z.string()),
});

export type AssetClass = z.infer<typeof assetClassSchema>;
export type AccountStatus = z.infer<typeof accountStatusSchema>;
export type Session = z.infer<typeof sessionSchema>;
export type Instrument = z.infer<typeof instrumentSchema>;
export type Position = z.infer<typeof positionSchema>;
export type Fill = z.infer<typeof fillSchema>;
export type Snapshot = z.infer<typeof snapshotSchema>;
export type Account = z.infer<typeof accountSchema>;

import { z } from "zod";

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

export const rulesetSchema = z.object({
    profitTarget: z.number().nonnegative(),
    maxDrawdown: z.number().nonnegative(),
    dailyDrawdown: z.number().nonnegative(),
    minTradingDays: z.number().int().nonnegative(),
});

export const phaseSchema = z.object({
    name: z.string().min(1),
    kind: z.enum(["eval", "funded"]),
    balance: z.number().positive(),
    fee: z.number().nonnegative().optional(),
    ruleset: rulesetSchema,
});

export const payoutModes = [
    "debitOnApprove",
    "freezeUntilPaid",
    "debitOnPaid",
] as const;

export const onUncoverablePolicies = ["failApprove", "autoReject"] as const;

export const onUncoverableSchema = z.enum(onUncoverablePolicies);

export const productPayoutSchema = z
    .object({
        split: z.number().min(0).max(1).default(0.8),
        mode: z.enum(payoutModes).default("debitOnApprove"),
        onUncoverable: onUncoverableSchema.optional(),
    })
    .superRefine((val, ctx) => {
        if (val.mode !== "debitOnApprove") {
            ctx.addIssue({
                code: "custom",
                message: `payout mode ${val.mode} is not implemented`,
                path: ["mode"],
            });
        }
    });

export const firmPayoutSchema = z.object({
    onUncoverable: onUncoverableSchema.default("failApprove"),
});

export const bridgeSchema = z.object({
    provider: z.string().min(1).default("loopback"),
});

export const productSchema = z
    .object({
        id: z.string().min(1),
        name: z.string().min(1),
        phases: z.array(phaseSchema).min(1),
        payout: productPayoutSchema.optional(),
    })
    .superRefine((val, ctx) => {
        const funded = val.phases.some((p) => p.kind === "funded");
        if (funded && !val.payout) {
            ctx.addIssue({
                code: "custom",
                message: "funded phase requires payout spec",
                path: ["payout"],
            });
        }
        if (!funded && val.payout) {
            ctx.addIssue({
                code: "custom",
                message: "payout spec requires a funded phase",
                path: ["payout"],
            });
        }
    });

export const modulesSchema = z.object({
    affiliates: z.boolean().default(false),
    kyc: z.boolean().default(false),
    multiBrand: z.boolean().default(false),
});

export const dailyCloseSchema = z.object({
    tz: z.string().min(1),
    time: hhmm,
});

export const checkoutSchema = z.object({
    provider: z.string().min(1).default("manual"),
    currency: z.string().min(1).default("usd"),
});

export const firmConfigSchema = z.object({
    name: z.string().min(1),
    dailyClose: dailyCloseSchema,
    modules: modulesSchema.default({
        affiliates: false,
        kyc: false,
        multiBrand: false,
    }),
    checkout: checkoutSchema.default({
        provider: "manual",
        currency: "usd",
    }),
    payout: firmPayoutSchema.default({ onUncoverable: "failApprove" }),
    bridge: bridgeSchema.default({ provider: "loopback" }),
    products: z.array(productSchema).min(1),
});

export type Ruleset = z.infer<typeof rulesetSchema>;
export type Phase = z.infer<typeof phaseSchema>;
export type Product = z.infer<typeof productSchema>;
export type Modules = z.infer<typeof modulesSchema>;
export type DailyClose = z.infer<typeof dailyCloseSchema>;
export type Checkout = z.infer<typeof checkoutSchema>;
export type ProductPayout = z.infer<typeof productPayoutSchema>;
export type FirmPayout = z.infer<typeof firmPayoutSchema>;
export type Bridge = z.infer<typeof bridgeSchema>;
export type PayoutMode = (typeof payoutModes)[number];
export type OnUncoverable = (typeof onUncoverablePolicies)[number];
export type FirmConfig = z.infer<typeof firmConfigSchema>;

export function onUncoverableFor(
    firm: FirmConfig,
    product: Product,
): OnUncoverable {
    return product.payout?.onUncoverable ?? firm.payout.onUncoverable;
}

export function parseFirmConfig(input: unknown): FirmConfig {
    return firmConfigSchema.parse(input);
}

export function loadFirmConfig(json: string): FirmConfig {
    return parseFirmConfig(JSON.parse(json) as unknown);
}

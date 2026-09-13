import { z } from "zod";

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

const fraction = z.number().min(0).max(1);

export const onBreachModes = ["fail", "warn", "flag"] as const;
export const consistencyModes = ["bestDay", "bestTrade"] as const;

export const onBreachSchema = z.enum(onBreachModes);

export const optionalBreachSchema = z.object({
    onBreach: onBreachSchema,
    closeTrade: z.boolean().default(false),
});

export const consistencySchema = z.object({
    mode: z.enum(consistencyModes),
    threshold: fraction,
    onBreach: onBreachSchema,
    closeTrade: z.boolean().default(false),
});

export const maxLotSchema = z.object({
    qty: z.number().positive(),
    onBreach: onBreachSchema,
    closeTrade: z.boolean().default(false),
});

export const rulesetSchema = z.object({
    profitTarget: fraction,
    maxDrawdown: fraction,
    dailyDrawdown: fraction,
    minTradingDays: z.number().int().nonnegative(),
    maxWarnings: z.number().int().positive().optional(),
    consistency: consistencySchema.optional(),
    weekend: optionalBreachSchema.optional(),
    maxLot: maxLotSchema.optional(),
});

export const phaseKinds = ["eval", "funded"] as const;

export const phaseSchema = z.object({
    name: z.string().min(1),
    kind: z.enum(phaseKinds),
    balance: z.number().positive(),
    fee: z.number().nonnegative().optional(),
    ruleset: rulesetSchema,
});

export const payoutModes = ["debitOnApprove", "freezeUntilApproved"] as const;

export const onUncoverablePolicies = ["failApprove", "autoReject"] as const;

export const onUncoverableSchema = z.enum(onUncoverablePolicies);

export const productPayoutSchema = z.object({
    split: z.number().min(0).max(1).default(0.8),
    mode: z.enum(payoutModes).default("debitOnApprove"),
    onUncoverable: onUncoverableSchema.optional(),
});

export const firmPayoutSchema = z.object({
    onUncoverable: onUncoverableSchema.default("failApprove"),
});

export const bridgeSchema = z
    .object({
        provider: z.string().min(1).default("loopback"),
        url: z.url().optional(),
    })
    .superRefine((val, ctx) => {
        if (val.provider === "webhook" && !val.url) {
            ctx.addIssue({
                code: "custom",
                message: "webhook bridge requires url",
                path: ["url"],
            });
        }
    });

export const productSchema = z
    .object({
        id: z.string().min(1),
        name: z.string().min(1),
        brokers: z.array(z.string().min(1)).min(1),
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

export const brokerSchema = z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    bridge: bridgeSchema,
});

export const firmIdSchema = z.string().regex(/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/);

export const firmConfigSchema = z
    .object({
        id: firmIdSchema,
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
        brokers: z.array(brokerSchema).min(1),
        products: z.array(productSchema).min(1),
    })
    .superRefine((val, ctx) => {
        const ids = new Set<string>();
        for (const [i, b] of val.brokers.entries()) {
            if (ids.has(b.id)) {
                ctx.addIssue({
                    code: "custom",
                    message: "duplicate broker id",
                    path: ["brokers", i, "id"],
                });
            }
            ids.add(b.id);
        }
        for (const [pi, p] of val.products.entries()) {
            for (const [bi, id] of p.brokers.entries()) {
                if (!ids.has(id)) {
                    ctx.addIssue({
                        code: "custom",
                        message: "unknown broker",
                        path: ["products", pi, "brokers", bi],
                    });
                }
            }
        }
    });

export type OnBreach = (typeof onBreachModes)[number];
export type ConsistencyMode = (typeof consistencyModes)[number];
export type Ruleset = z.infer<typeof rulesetSchema>;
export type Phase = z.infer<typeof phaseSchema>;
export type Product = z.infer<typeof productSchema>;
export type Modules = z.infer<typeof modulesSchema>;
export type DailyClose = z.infer<typeof dailyCloseSchema>;
export type Checkout = z.infer<typeof checkoutSchema>;
export type ProductPayout = z.infer<typeof productPayoutSchema>;
export type FirmPayout = z.infer<typeof firmPayoutSchema>;
export type Bridge = z.infer<typeof bridgeSchema>;
export type Broker = z.infer<typeof brokerSchema>;
export type PayoutMode = (typeof payoutModes)[number];
export type OnUncoverable = (typeof onUncoverablePolicies)[number];
export type FirmConfig = z.infer<typeof firmConfigSchema>;

export function ingestKeyEnvName(brokerId: string): string {
    return `INGEST_API_KEY_${brokerId.replace(/[^A-Za-z0-9]+/g, "_").toUpperCase()}`;
}

export function bridgeKeyEnvName(brokerId: string): string {
    return `BRIDGE_WEBHOOK_KEY_${brokerId.replace(/[^A-Za-z0-9]+/g, "_").toUpperCase()}`;
}

export function brokerOf(firm: FirmConfig, id: string): Broker | undefined {
    return firm.brokers.find((b) => b.id === id);
}

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

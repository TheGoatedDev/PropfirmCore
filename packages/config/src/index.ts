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

function refineProductPayout(
    val: { phases: { kind: string }[]; payout?: unknown },
    ctx: z.RefinementCtx,
) {
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
}

const productFields = z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    brokers: z.array(z.string().min(1)).min(1),
    phases: z.array(phaseSchema).min(1),
    payout: productPayoutSchema.optional(),
});

export const productSchema = productFields.superRefine(refineProductPayout);

export const productWriteSchema = productFields
    .extend({ id: z.string().min(1).optional() })
    .superRefine(refineProductPayout);

export const kycGates = ["payout", "funded"] as const;

export const kycModuleSchema = z.object({
    enabled: z.boolean().default(false),
    gate: z.enum(kycGates).default("payout"),
});

export const modulesSchema = z.object({
    affiliates: z.boolean().default(false),
    kyc: kycModuleSchema.default({ enabled: false, gate: "payout" }),
    multiBrand: z.boolean().default(false),
});

export function isTimeZone(tz: string): boolean {
    try {
        new Intl.DateTimeFormat("en-US", { timeZone: tz });
        return true;
    } catch {
        return false;
    }
}

const isoCurrencies = new Set(Intl.supportedValuesOf("currency"));

export function isCurrency(code: string): boolean {
    return /^[a-z]{3}$/i.test(code) && isoCurrencies.has(code.toUpperCase());
}

export const dailyCloseSchema = z.object({
    tz: z.string().min(1).refine(isTimeZone, "Unknown timezone"),
    time: hhmm,
});

/** Checkout adapters the server ships. Add here when an adapter lands. */
export const checkoutProviders = ["manual"] as const;

export const checkoutSchema = z.object({
    provider: z.enum(checkoutProviders).default("manual"),
    currency: z
        .string()
        .refine(isCurrency, "Use a 3-letter ISO 4217 code")
        .default("usd"),
});

export const brokerSchema = z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    bridge: bridgeSchema,
});

/** Strict: keys never travel in Firm config. Read-only flags are ignored. */
export const brokerWriteSchema = brokerSchema
    .extend({
        id: z.string().min(1).optional(),
        hasIngestKey: z.boolean().optional(),
        hasBridgeKey: z.boolean().optional(),
    })
    .strict();

export const brokerSeedSchema = brokerSchema.extend({
    ingestKey: z.string().min(1).optional(),
    bridgeKey: z.string().min(1).optional(),
});

export const firmIdSchema = z.string().regex(/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/);

function refineBrokerRefs(
    val: {
        brokers: { id?: string }[];
        products: { brokers: string[] }[];
    },
    ctx: z.RefinementCtx,
) {
    const ids = new Set<string>();
    for (const [i, b] of val.brokers.entries()) {
        if (!b.id) continue;
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
}

const firmFields = {
    id: firmIdSchema,
    name: z.string().trim().min(1, "Name is required").max(80),
    dailyClose: dailyCloseSchema,
    modules: modulesSchema.default({
        affiliates: false,
        kyc: { enabled: false, gate: "payout" },
        multiBrand: false,
    }),
    checkout: checkoutSchema.default({
        provider: "manual",
        currency: "usd",
    }),
    payout: firmPayoutSchema.default({ onUncoverable: "failApprove" }),
};

/**
 * Firm settings without brokers and products, every field required. The
 * admin settings form validates against this before it saves.
 */
export const firmSettingsSchema = z.object({
    id: firmIdSchema,
    name: firmFields.name,
    dailyClose: dailyCloseSchema,
    modules: z.object({
        affiliates: z.boolean(),
        kyc: z.object({ enabled: z.boolean(), gate: z.enum(kycGates) }),
        multiBrand: z.boolean(),
    }),
    checkout: z.object({
        provider: z.enum(checkoutProviders),
        currency: z.string().refine(isCurrency, "Use a 3-letter ISO 4217 code"),
    }),
    payout: z.object({ onUncoverable: onUncoverableSchema }),
});

export const firmConfigSchema = z
    .object({
        ...firmFields,
        brokers: z.array(brokerSchema).min(1),
        products: z.array(productSchema).min(1),
    })
    .superRefine(refineBrokerRefs);

export const firmConfigWriteSchema = z
    .object({
        ...firmFields,
        brokers: z.array(brokerWriteSchema).min(1),
        products: z.array(productWriteSchema).min(1),
    })
    .superRefine(refineBrokerRefs);

export const brokerViewSchema = brokerSchema.extend({
    hasIngestKey: z.boolean(),
    hasBridgeKey: z.boolean(),
});

/** Firm config as an Admin reads it: brokers say whether keys are set. */
export const firmViewSchema = z.object({
    ...firmFields,
    brokers: z.array(brokerViewSchema).min(1),
    products: z.array(productSchema).min(1),
});

export const firmSeedSchema = z
    .object({
        ...firmFields,
        brokers: z.array(brokerSeedSchema).min(1),
        products: z.array(productSchema).min(1),
    })
    .superRefine(refineBrokerRefs);

export type OnBreach = (typeof onBreachModes)[number];
export type ConsistencyMode = (typeof consistencyModes)[number];
export type Ruleset = z.infer<typeof rulesetSchema>;
export type Phase = z.infer<typeof phaseSchema>;
export type Product = z.infer<typeof productSchema>;
export type ProductWrite = z.infer<typeof productWriteSchema>;
export type KycGate = (typeof kycGates)[number];
export type KycModule = z.infer<typeof kycModuleSchema>;
export type Modules = z.infer<typeof modulesSchema>;
export type DailyClose = z.infer<typeof dailyCloseSchema>;
export type Checkout = z.infer<typeof checkoutSchema>;
export type ProductPayout = z.infer<typeof productPayoutSchema>;
export type FirmPayout = z.infer<typeof firmPayoutSchema>;
export type Bridge = z.infer<typeof bridgeSchema>;
export type Broker = z.infer<typeof brokerSchema>;
export type BrokerWrite = z.infer<typeof brokerWriteSchema>;
export type BrokerView = z.infer<typeof brokerViewSchema>;
export type FirmView = z.infer<typeof firmViewSchema>;
export type BrokerSeed = z.infer<typeof brokerSeedSchema>;
export type FirmSeed = z.infer<typeof firmSeedSchema>;
export type PayoutMode = (typeof payoutModes)[number];
export type OnUncoverable = (typeof onUncoverablePolicies)[number];
export type FirmConfig = z.infer<typeof firmConfigSchema>;
export type FirmSettings = z.infer<typeof firmSettingsSchema>;
export type FirmConfigWrite = z.infer<typeof firmConfigWriteSchema>;

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

export function parseFirmConfigWrite(input: unknown): FirmConfigWrite {
    return firmConfigWriteSchema.parse(input);
}

export function loadFirmConfig(json: string): FirmConfig {
    return parseFirmConfig(JSON.parse(json) as unknown);
}

export function loadFirmSeed(json: string): FirmSeed {
    return firmSeedSchema.parse(JSON.parse(json) as unknown);
}

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

export const productSchema = z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    phases: z.array(phaseSchema).min(1),
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
    products: z.array(productSchema).min(1),
});

export type Ruleset = z.infer<typeof rulesetSchema>;
export type Phase = z.infer<typeof phaseSchema>;
export type Product = z.infer<typeof productSchema>;
export type Modules = z.infer<typeof modulesSchema>;
export type DailyClose = z.infer<typeof dailyCloseSchema>;
export type Checkout = z.infer<typeof checkoutSchema>;
export type FirmConfig = z.infer<typeof firmConfigSchema>;

export function parseFirmConfig(input: unknown): FirmConfig {
    return firmConfigSchema.parse(input);
}

export function loadFirmConfig(json: string): FirmConfig {
    return parseFirmConfig(JSON.parse(json) as unknown);
}

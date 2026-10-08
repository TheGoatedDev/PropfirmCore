import type { ProductWrite } from "@propfirmcore/config";

export const defaultPayout = {
    split: 0.8,
    mode: "debitOnApprove",
} as const satisfies NonNullable<ProductWrite["payout"]>;

type WithPayout = {
    phases: readonly { kind: string }[];
    payout?: { split?: number; mode?: string };
};

/**
 * A payout spec belongs to products with a funded phase, and only to them
 * (config rejects both mismatches). The form keeps one around while phases
 * are edited; this settles it for saving. Works on form input and output.
 */
export function productForSave<T extends WithPayout>(p: T): T {
    const funded = p.phases.some((ph) => ph.kind === "funded");
    if (funded) return { ...p, payout: p.payout ?? { ...defaultPayout } };
    const { payout: _, ...rest } = p;
    return rest as T;
}

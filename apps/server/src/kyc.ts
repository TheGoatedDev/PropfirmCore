import type { FirmConfig, Product } from "@propfirmcore/config";
import { eq } from "drizzle-orm";
import { user } from "./auth/auth-schema.ts";
import type { Db } from "./db/db.ts";

type Exec = Db | Parameters<Parameters<Db["transaction"]>[0]>[0];

export function kycBlocksCash(firm: FirmConfig, verified: boolean): boolean {
    return firm.modules.kyc.enabled && !verified;
}

export function kycBlocksFundedEntry(
    firm: FirmConfig,
    verified: boolean,
): boolean {
    return (
        firm.modules.kyc.enabled &&
        firm.modules.kyc.gate === "funded" &&
        !verified
    );
}

export function kycBlocksInstantFunded(
    firm: FirmConfig,
    verified: boolean,
    product: Product,
): boolean {
    return (
        kycBlocksFundedEntry(firm, verified) &&
        product.phases[0]?.kind === "funded"
    );
}

export function kycForMe(firm: FirmConfig): {
    enabled: boolean;
    gate: "payout" | "funded";
} | null {
    return firm.modules.kyc.enabled ? firm.modules.kyc : null;
}

export async function kycVerifiedOf(
    db: Exec,
    userId: string,
): Promise<boolean> {
    const rows = await db
        .select({ kycVerified: user.kycVerified })
        .from(user)
        .where(eq(user.id, userId))
        .limit(1);
    return rows[0]?.kycVerified ?? false;
}

export async function setKycVerified(
    db: Exec,
    userId: string,
    verified: boolean,
): Promise<boolean> {
    const rows = await db
        .update(user)
        .set({ kycVerified: verified })
        .where(eq(user.id, userId))
        .returning({ id: user.id });
    return rows.length > 0;
}

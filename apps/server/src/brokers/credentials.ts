import { createHash, randomBytes } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { brokers, type Db } from "../db/db.ts";

export const ingestKeyPrefix = "pfc_ik_";

export type BrokerSecret = {
    ingestKeyHash: string | null;
    bridgeKey: string | null;
};

/** brokerId -> secrets. Process-wide; reloaded on `firm_config` NOTIFY. */
export type BrokerSecrets = Map<string, BrokerSecret>;

export const brokerSecrets: BrokerSecrets = new Map();

export function newIngestKey(): string {
    return `${ingestKeyPrefix}${randomBytes(32).toString("base64url")}`;
}

export function hashKey(key: string): string {
    return createHash("sha256").update(key).digest("hex");
}

export function matchIngestKey(
    secrets: BrokerSecrets,
    got: string | undefined,
): string | undefined {
    if (!got) return undefined;
    const want = hashKey(got);
    for (const [id, s] of secrets) {
        if (s.ingestKeyHash === want) return id;
    }
    return undefined;
}

export function bridgeKeyOf(
    secrets: BrokerSecrets,
    brokerId: string,
): string | undefined {
    return secrets.get(brokerId)?.bridgeKey ?? undefined;
}

export async function loadBrokerSecrets(
    db: Db,
    into: BrokerSecrets = brokerSecrets,
): Promise<BrokerSecrets> {
    const rows = await db
        .select({
            id: brokers.id,
            ingestKeyHash: brokers.ingestKeyHash,
            bridgeKey: brokers.bridgeKey,
        })
        .from(brokers);
    into.clear();
    for (const r of rows) {
        into.set(r.id, {
            ingestKeyHash: r.ingestKeyHash,
            bridgeKey: r.bridgeKey,
        });
    }
    return into;
}

async function setColumns(
    db: Db,
    brokerId: string,
    set: Partial<{ ingestKeyHash: string | null; bridgeKey: string | null }>,
): Promise<boolean> {
    return db.transaction(async (tx) => {
        const rows = await tx
            .update(brokers)
            .set(set)
            .where(eq(brokers.id, brokerId))
            .returning({ id: brokers.id });
        if (!rows.length) return false;
        await tx.execute(sql`notify firm_config`);
        return true;
    });
}

/** Returns the new plaintext key, or undefined if the broker is unknown. */
export async function rotateIngestKey(
    db: Db,
    brokerId: string,
): Promise<string | undefined> {
    const key = newIngestKey();
    const ok = await setColumns(db, brokerId, { ingestKeyHash: hashKey(key) });
    return ok ? key : undefined;
}

export function revokeIngestKey(db: Db, brokerId: string): Promise<boolean> {
    return setColumns(db, brokerId, { ingestKeyHash: null });
}

export function setBridgeKey(
    db: Db,
    brokerId: string,
    key: string | null,
): Promise<boolean> {
    return setColumns(db, brokerId, { bridgeKey: key });
}

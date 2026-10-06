import {
    type FirmConfigWrite,
    type FirmView,
    firmViewSchema,
    parseFirmConfigWrite,
} from "@propfirmcore/config";
import { api, failMsg } from "./api.ts";

export function cleanFirm(cfg: FirmConfigWrite): FirmConfigWrite {
    return {
        ...cfg,
        products: cfg.products.map((p) => {
            if (p.phases.some((ph) => ph.kind === "funded")) return p;
            const { payout: _, ...rest } = p;
            return rest;
        }),
    };
}

export async function fetchFirm(): Promise<FirmView> {
    const { data, error } = await api.GET("/firm");
    if (error || !data) throw new Error(failMsg(error, "Load failed"));
    return firmViewSchema.parse(data);
}

export async function saveFirmSlice(
    patch: (firm: FirmView) => FirmConfigWrite,
): Promise<FirmView> {
    const current = await fetchFirm();
    let next: FirmConfigWrite;
    try {
        next = parseFirmConfigWrite(cleanFirm(patch(current)));
    } catch (err) {
        throw new Error(err instanceof Error ? err.message : "Invalid firm");
    }
    const { data, error } = await api.PUT("/firm", { body: next });
    if (error || !data) throw new Error(failMsg(error, "Save failed"));
    return firmViewSchema.parse(data);
}

/** Returns the new Ingest key. Shown once. */
export async function rotateIngestKey(brokerId: string): Promise<string> {
    const { data, error } = await api.POST("/firm/brokers/{id}/ingest-key", {
        params: { path: { id: brokerId } },
    });
    if (error || !data) throw new Error(failMsg(error, "Rotate failed"));
    return data.ingestKey;
}

export async function revokeIngestKey(brokerId: string): Promise<void> {
    const { error } = await api.DELETE("/firm/brokers/{id}/ingest-key", {
        params: { path: { id: brokerId } },
    });
    if (error) throw new Error(failMsg(error, "Revoke failed"));
}

export async function setBridgeKey(
    brokerId: string,
    key: string | null,
): Promise<void> {
    const { error } = await api.PUT("/firm/brokers/{id}/bridge-key", {
        params: { path: { id: brokerId } },
        body: { key },
    });
    if (error) throw new Error(failMsg(error, "Save failed"));
}

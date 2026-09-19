import {
    type FirmConfig,
    type FirmConfigWrite,
    parseFirmConfig,
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

export async function fetchFirm(): Promise<FirmConfig> {
    const { data, error } = await api.GET("/firm");
    if (error || !data) throw new Error(failMsg(error, "Load failed"));
    return parseFirmConfig(data);
}

export async function saveFirmSlice(
    patch: (firm: FirmConfig) => FirmConfigWrite,
): Promise<FirmConfig> {
    const current = await fetchFirm();
    let next: FirmConfigWrite;
    try {
        next = parseFirmConfigWrite(cleanFirm(patch(current)));
    } catch (err) {
        throw new Error(err instanceof Error ? err.message : "Invalid firm");
    }
    const { data, error } = await api.PUT("/firm", { body: next });
    if (error || !data) throw new Error(failMsg(error, "Save failed"));
    return parseFirmConfig(data);
}

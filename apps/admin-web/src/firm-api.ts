import { type FirmConfig, parseFirmConfig } from "@propfirmcore/config";
import { api, failMsg } from "./api.ts";

export function cleanFirm(cfg: FirmConfig): FirmConfig {
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
    patch: (firm: FirmConfig) => FirmConfig,
): Promise<FirmConfig> {
    const current = await fetchFirm();
    let next: FirmConfig;
    try {
        next = parseFirmConfig(cleanFirm(patch(current)));
    } catch (err) {
        throw new Error(err instanceof Error ? err.message : "Invalid firm");
    }
    const { data, error } = await api.PUT("/firm", { body: next });
    if (error || !data) throw new Error(failMsg(error, "Save failed"));
    return parseFirmConfig(data);
}

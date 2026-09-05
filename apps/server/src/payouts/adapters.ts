import type { Bridge as BridgeConfig } from "@propfirmcore/config";
import { loopbackBridge } from "./loopback.ts";
import type { Bridge } from "./port.ts";
import { createWebhookBridge } from "./webhook.ts";

export const bridges: Record<string, Bridge> = {
    loopback: loopbackBridge,
};

export function getBridge(cfg: BridgeConfig): Bridge | undefined {
    if (cfg.provider === "webhook") {
        return cfg.url
            ? createWebhookBridge(cfg.url, process.env.BRIDGE_WEBHOOK_KEY)
            : undefined;
    }
    return bridges[cfg.provider];
}

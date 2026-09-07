import {
    bridgeKeyEnvName,
    brokerOf,
    type FirmConfig,
} from "@propfirmcore/config";
import { loopbackBridge } from "./loopback.ts";
import type { Bridge } from "./port.ts";
import { createWebhookBridge } from "./webhook.ts";

export const bridges: Record<string, Bridge> = {
    loopback: loopbackBridge,
};

export function getBridge(
    firm: FirmConfig,
    brokerId: string,
): Bridge | undefined {
    const broker = brokerOf(firm, brokerId);
    if (!broker) return undefined;
    if (broker.bridge.provider === "webhook") {
        return broker.bridge.url
            ? createWebhookBridge(
                  broker.bridge.url,
                  process.env[bridgeKeyEnvName(broker.id)],
              )
            : undefined;
    }
    return bridges[broker.bridge.provider];
}

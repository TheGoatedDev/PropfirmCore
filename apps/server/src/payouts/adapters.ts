import { loopbackBridge } from "./loopback.ts";
import type { Bridge } from "./port.ts";

export const bridges: Record<string, Bridge> = {
    loopback: loopbackBridge,
};

export function getBridge(provider: string): Bridge | undefined {
    return bridges[provider];
}

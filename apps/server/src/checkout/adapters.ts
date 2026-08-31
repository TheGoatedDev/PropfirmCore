import { manualAdapter } from "./manual.ts";
import type { CheckoutAdapter } from "./port.ts";

export const checkoutAdapters: Record<string, CheckoutAdapter> = {
    manual: manualAdapter,
};

export function getAdapter(provider: string): CheckoutAdapter | undefined {
    return checkoutAdapters[provider];
}

import { applyPayout } from "@propfirmcore/domain";
import type { Bridge } from "./port.ts";

export const loopbackBridge: Bridge = {
    async withdraw(account, amount) {
        return applyPayout(account, amount);
    },
    async deposit(account, amount) {
        return applyPayout(account, -amount);
    },
};

import type { TradingAccount } from "@propfirmcore/domain";

export type Bridge = {
    withdraw(account: TradingAccount, amount: number): Promise<TradingAccount>;
    deposit(account: TradingAccount, amount: number): Promise<TradingAccount>;
};

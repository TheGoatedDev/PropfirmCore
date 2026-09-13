import type { TradingAccount } from "@propfirmcore/domain";

export type Provisioned = { login: string; password: string };

export type Bridge = {
    withdraw(account: TradingAccount, amount: number): Promise<TradingAccount>;
    deposit(account: TradingAccount, amount: number): Promise<TradingAccount>;
    freeze(account: TradingAccount): Promise<void>;
    unfreeze(account: TradingAccount): Promise<void>;
    provision(account: TradingAccount, balance: number): Promise<Provisioned>;
    close(account: TradingAccount, positionId: string): Promise<void>;
};

import { applyPayout, type TradingAccount } from "@propfirmcore/domain";

export type MockBook = {
    account: TradingAccount;
    frozen: boolean;
    seq: number;
};

export type BridgeAction =
    | { action: "withdraw"; accountId: string; amount: number }
    | { action: "deposit"; accountId: string; amount: number }
    | { action: "freeze"; accountId: string }
    | { action: "unfreeze"; accountId: string }
    | { action: "provision"; accountId: string; balance: number };

export function provisionBook(accountId: string, balance: number): MockBook {
    return {
        account: {
            id: accountId,
            firmId: "acme",
            userId: "broker",
            productId: "broker",
            phaseIndex: 0,
            status: "active",
            startBalance: balance,
            equity: balance,
            balance,
            peakEquity: balance,
            dailyStartEquity: balance,
            tradingDayKey: "",
            tradingDays: [],
            brokerId: "mock",
            brokerLogin: accountId,
            brokerPassword: "mock",
        },
        frozen: false,
        seq: 0,
    };
}

export function applyAction(book: MockBook, body: BridgeAction): void {
    switch (body.action) {
        case "freeze":
            book.frozen = true;
            return;
        case "unfreeze":
            book.frozen = false;
            return;
        case "withdraw":
            book.account = applyPayout(book.account, body.amount);
            return;
        case "deposit":
            book.account = applyPayout(book.account, -body.amount);
            return;
        case "provision":
            return;
    }
}

export function nextExternalId(book: MockBook): string {
    book.seq++;
    return `${book.account.id}-${book.seq}`;
}

export function drift(book: MockBook): void {
    if (book.frozen) return;
    const d = (Math.random() - 0.45) * 10;
    book.account = {
        ...book.account,
        equity: book.account.equity + d,
        balance: book.account.balance + d,
    };
}

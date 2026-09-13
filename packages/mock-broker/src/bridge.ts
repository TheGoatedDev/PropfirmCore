import { z } from "zod";
import {
    applyAction,
    type BridgeAction,
    type MockBook,
    provisionBook,
} from "./book.ts";

export const bridgeActionSchema: z.ZodType<BridgeAction> = z.union([
    z.object({
        action: z.literal("withdraw"),
        accountId: z.string().min(1),
        amount: z.number(),
    }),
    z.object({
        action: z.literal("deposit"),
        accountId: z.string().min(1),
        amount: z.number(),
    }),
    z.object({
        action: z.literal("freeze"),
        accountId: z.string().min(1),
    }),
    z.object({
        action: z.literal("unfreeze"),
        accountId: z.string().min(1),
    }),
    z.object({
        action: z.literal("provision"),
        accountId: z.string().min(1),
        balance: z.number(),
    }),
    z.object({
        action: z.literal("closePosition"),
        accountId: z.string().min(1),
        positionId: z.string().min(1),
    }),
]);

export type BridgeResult = {
    status: number;
    body?: { login: string; password: string };
};

export function handleBridge(
    books: Map<string, MockBook>,
    expectedKey: string | undefined,
    apiKey: string | undefined,
    body: unknown,
): BridgeResult {
    if (expectedKey && apiKey !== expectedKey) return { status: 401 };
    const parsed = bridgeActionSchema.safeParse(body);
    if (!parsed.success) return { status: 400 };
    if (parsed.data.action === "provision") {
        const existing = books.get(parsed.data.accountId);
        const book =
            existing ??
            provisionBook(parsed.data.accountId, parsed.data.balance);
        books.set(parsed.data.accountId, book);
        return {
            status: 200,
            body: {
                login: book.account.brokerLogin,
                password: book.account.brokerPassword,
            },
        };
    }
    const book = books.get(parsed.data.accountId);
    if (!book) return { status: 404 };
    applyAction(book, parsed.data);
    return { status: 204 };
}

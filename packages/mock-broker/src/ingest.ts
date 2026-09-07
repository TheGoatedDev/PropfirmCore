import { type ApiClient, createApiClient } from "@propfirmcore/api-client";
import { tradingAccountSchema } from "@propfirmcore/domain";
import { type MockBook, nextExternalId } from "./book.ts";

export function makeIngestClient(baseUrl: string, apiKey: string): ApiClient {
    return createApiClient(baseUrl, {
        fetch: async (input: Request) => {
            const headers = new Headers(input.headers);
            headers.set("X-Api-Key", apiKey);
            headers.set("Origin", baseUrl);
            return fetch(new Request(input, { headers }));
        },
    });
}

export async function trySeedBook(
    client: ApiClient,
    id: string,
): Promise<MockBook | null> {
    const { data, error } = await client.GET("/ingest/trading-accounts/{id}", {
        params: { path: { id } },
    });
    if (error || !data) return null;
    return {
        account: tradingAccountSchema.parse(data),
        frozen: false,
        seq: 0,
    };
}

export async function seedBooks(
    client: ApiClient,
    ids: string[],
): Promise<Map<string, MockBook>> {
    const books = new Map<string, MockBook>();
    for (const id of ids) {
        const book = await trySeedBook(client, id);
        if (!book) throw new Error(`seed ${id}`);
        books.set(id, book);
    }
    return books;
}

export async function postFill(
    client: ApiClient,
    book: MockBook,
    ts: string,
): Promise<number> {
    if (book.frozen) return 409;
    const id = book.account.id;
    const externalId = nextExternalId(book);
    const { response } = await client.POST(
        "/ingest/trading-accounts/{id}/fills",
        {
            params: { path: { id } },
            body: {
                fills: [
                    {
                        externalId,
                        positionId: `${id}-p`,
                        symbol: "EURUSD",
                        class: "fx",
                        qty: 1,
                        price: 1.1,
                        side: "buy",
                        ts,
                        multiplier: 100_000,
                        tickSize: 0.00001,
                        currency: "USD",
                    },
                ],
            },
        },
    );
    if (response.status === 409) book.frozen = true;
    return response.status;
}

export async function postSnapshot(
    client: ApiClient,
    book: MockBook,
    ts: string,
): Promise<number> {
    const { response } = await client.POST(
        "/ingest/trading-accounts/{id}/snapshot",
        {
            params: { path: { id: book.account.id } },
            body: {
                externalId: nextExternalId(book),
                equity: book.account.equity,
                balance: book.account.balance,
                ts,
                positions: [],
            },
        },
    );
    return response.status;
}

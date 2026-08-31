import createClient from "openapi-fetch";
import type { paths } from "./schema.ts";

export type { paths };
export type ApiClient = ReturnType<typeof createClient<paths>>;

export function createApiClient(
    baseUrl: string,
    options?: Omit<
        NonNullable<Parameters<typeof createClient<paths>>[0]>,
        "baseUrl"
    >,
) {
    return createClient<paths>({ baseUrl, ...options });
}

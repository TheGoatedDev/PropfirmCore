import { z } from "@hono/zod-openapi";

export const errorSchema = z.object({
    error: z.string().describe("What went wrong, in plain language."),
});

export const httpDesc = {
    unauthorized: "You are not signed in, or the API key is missing or wrong.",
    forbidden: "You do not have permission to do this.",
    badRequest: "The request was invalid. Check the body and parameters.",
    notFound: "Nothing exists at this id.",
    exists: "A resource with this id already exists.",
    accepted: "Queued. GET the trading account for the settled book.",
    unavailable: "The ingest bus is down. Try again.",
} as const;

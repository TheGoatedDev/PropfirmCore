import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
    server: {
        DATABASE_URL: z.string().min(1),
        NATS_URL: z.string().min(1),
        NATS_TOKEN: z.string().min(1),
        INGEST_API_KEY: z.string().min(1),
        BETTER_AUTH_SECRET: z.string().min(1),
        BETTER_AUTH_URL: z.url().default("http://localhost:3000"),
        PORT: z.coerce.number().default(3000),
        FIRM_CONFIG_PATH: z.string().min(1).optional(),
        BOOTSTRAP_ADMIN_EMAIL: z.string().min(1).optional(),
        BOOTSTRAP_ADMIN_PASSWORD: z.string().min(1).optional(),
    },
    runtimeEnv: process.env,
    emptyStringAsUndefined: true,
});

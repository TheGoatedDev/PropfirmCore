import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { firmAccess } from "@propfirmcore/access/server";
import { betterAuth } from "better-auth";
import { bearer, openAPI } from "better-auth/plugins";
import type { Db } from "../db/db.ts";
import * as authSchema from "./auth-schema.ts";

export function createAuth(db: Db, opts: { secret: string; baseURL: string }) {
    return betterAuth({
        secret: opts.secret,
        baseURL: opts.baseURL,
        basePath: "/auth",
        database: drizzleAdapter(db, {
            provider: "pg",
            schema: authSchema,
        }),
        emailAndPassword: { enabled: true },
        user: {
            additionalFields: {
                kycVerified: {
                    type: "boolean",
                    required: false,
                    defaultValue: false,
                    input: false,
                },
            },
        },
        trustedOrigins: [
            "http://localhost",
            "http://localhost:3000",
            "http://localhost:5173",
            "http://localhost:5174",
            "http://localhost:8081",
        ],
        plugins: [
            firmAccess(),
            bearer(),
            openAPI({ disableDefaultReference: true }),
        ],
    });
}

export type Auth = ReturnType<typeof createAuth>;

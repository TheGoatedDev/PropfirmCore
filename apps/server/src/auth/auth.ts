import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { admin, bearer, openAPI } from "better-auth/plugins";
import type { Db } from "../db/db.ts";
import * as authSchema from "./auth-schema.ts";
import { ac, admin as adminRole, trader } from "./permissions.ts";

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
        trustedOrigins: [
            "http://localhost",
            "http://localhost:3000",
            "http://localhost:5173",
            "http://localhost:5174",
            "http://localhost:8081",
        ],
        plugins: [
            admin({
                ac,
                defaultRole: "trader",
                adminRoles: ["admin"],
                roles: { trader, admin: adminRole },
            }),
            bearer(),
            openAPI({ disableDefaultReference: true }),
        ],
    });
}

export type Auth = ReturnType<typeof createAuth>;

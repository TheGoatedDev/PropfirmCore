import { OpenAPIHono } from "@hono/zod-openapi";
import type { FirmConfig } from "@propfirmcore/config";
import { cors } from "hono/cors";
import type { Auth } from "../auth/auth.ts";
import { mountAuth } from "../auth/http.ts";
import { mountCheckout } from "../checkout/http.ts";
import type { Db } from "../db/db.ts";
import { mountIngest } from "../ingest/http.ts";
import { mountPayouts } from "../payouts/http.ts";
import { mountTradingAccounts } from "../trading-accounts/http.ts";
import { openApiInfo, withAuthOpenAPI } from "./openapi.ts";

export type AppDeps = {
    apiKey: string;
    firm: FirmConfig;
    db: Db;
    auth: Auth;
};

export function createApp(deps: AppDeps) {
    const app = new OpenAPIHono();

    app.use(
        "*",
        cors({
            origin: "http://localhost:8081",
            credentials: true,
        }),
    );

    app.openAPIRegistry.registerComponent("securitySchemes", "apiKey", {
        type: "apiKey",
        in: "header",
        name: "X-Api-Key",
    });

    app.get("/health", (c) => c.json({ ok: true }));

    mountAuth(app, deps);
    mountCheckout(app, deps);
    mountTradingAccounts(app, deps);
    mountPayouts(app, deps);
    mountIngest(app, deps);

    app.get("/openapi.json", async (c) => {
        const spec = app.getOpenAPIDocument(openApiInfo);
        return c.json(await withAuthOpenAPI(spec as never, deps.auth as never));
    });

    return app;
}

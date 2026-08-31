import { readFileSync, writeFileSync } from "node:fs";
import { loadFirmConfig } from "@propfirmcore/config";
import { createApp } from "./app.ts";
import type { Auth } from "./auth.ts";
import type { Db } from "./db.ts";

const firm = loadFirmConfig(
    readFileSync(
        new URL("../../../firm.example.json", import.meta.url),
        "utf8",
    ),
);

const app = createApp({
    apiKey: "export",
    firm,
    db: {} as Db,
    auth: {
        handler: () => new Response("not found", { status: 404 }),
        api: { getSession: async () => null },
    } as unknown as Auth,
});

const spec = app.getOpenAPIDocument({
    openapi: "3.0.0",
    info: { title: "PropfirmCore", version: "0.0.0" },
});

const out = new URL(
    "../../../packages/api-client/openapi.json",
    import.meta.url,
);
writeFileSync(out, `${JSON.stringify(spec, null, 4)}\n`);
console.log(`wrote ${out.pathname}`);

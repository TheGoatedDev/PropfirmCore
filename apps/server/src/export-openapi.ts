import { readFileSync, writeFileSync } from "node:fs";
import { loadFirmConfig } from "@propfirmcore/config";
import { createAuth } from "./auth/auth.ts";
import type { Db } from "./db/db.ts";
import { createApp } from "./http/app.ts";

const firm = loadFirmConfig(
    readFileSync(
        new URL("../../../firm.example.json", import.meta.url),
        "utf8",
    ),
);

const auth = createAuth({} as Db, {
    secret: "export-openapi-secret-32-chars-min",
    baseURL: "http://localhost:3000",
});

const app = createApp({
    apiKey: "export",
    firm,
    db: {} as Db,
    auth,
});

const res = await app.request("/openapi.json");
const spec = await res.json();

const out = new URL(
    "../../../packages/api-client/openapi.json",
    import.meta.url,
);
writeFileSync(out, `${JSON.stringify(spec, null, 4)}\n`);
console.log(`wrote ${out.pathname}`);

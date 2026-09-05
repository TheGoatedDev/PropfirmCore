import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

const appSrc = fileURLToPath(new URL("./src", import.meta.url));
const uiSrc = fileURLToPath(new URL("../../packages/ui/src", import.meta.url));
const uiMark = `${path.sep}packages${path.sep}ui${path.sep}`;

function atAlias(): Plugin {
    return {
        name: "at-alias",
        enforce: "pre",
        resolveId(id, importer) {
            if (!id.startsWith("@/")) return;
            const root = importer?.includes(uiMark) ? uiSrc : appSrc;
            const base = path.join(root, id.slice(2));
            for (const ext of ["", ".ts", ".tsx"]) {
                const file = base + ext;
                if (fs.existsSync(file)) return file;
            }
        },
    };
}

export default defineConfig({
    base: process.env.VITE_BASE || "/",
    plugins: [
        atAlias(),
        tanstackRouter({ target: "react" }),
        react(),
        tailwindcss(),
    ],
    server: {
        port: 5174,
        proxy: {
            "/api": {
                target: "http://localhost:3000",
                rewrite: (p) => p.replace(/^\/api/, ""),
            },
        },
    },
});

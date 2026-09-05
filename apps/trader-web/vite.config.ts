import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
    plugins: [tanstackRouter({ target: "react" }), react(), tailwindcss()],
    server: {
        port: 5173,
        proxy: {
            "/api": {
                target: "http://localhost:3000",
                rewrite: (p) => p.replace(/^\/api/, ""),
            },
        },
    },
});

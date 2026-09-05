import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen.ts";

const basepath = import.meta.env.BASE_URL.replace(/\/$/, "") || undefined;

export const router = createRouter({
    routeTree,
    ...(basepath ? { basepath } : {}),
});

declare module "@tanstack/react-router" {
    interface Register {
        router: typeof router;
    }
}

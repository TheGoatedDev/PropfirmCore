import type { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen.ts";

export const router = createRouter({
    routeTree,
    context: { queryClient: undefined as unknown as QueryClient },
});

declare module "@tanstack/react-router" {
    interface Register {
        router: typeof router;
    }
    interface StaticDataRouteOption {
        crumb?: string;
    }
}

import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import { NuqsAdapter } from "nuqs/adapters/tanstack-router";

function Root() {
    return (
        <NuqsAdapter>
            <Outlet />
        </NuqsAdapter>
    );
}

export const Route = createRootRouteWithContext<{
    queryClient: QueryClient;
}>()({ component: Root });

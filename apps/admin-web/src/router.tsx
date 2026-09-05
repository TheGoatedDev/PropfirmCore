import {
    createRootRoute,
    createRoute,
    createRouter,
} from "@tanstack/react-router";
import { Home } from "./routes/home.tsx";
import { Root } from "./routes/root.tsx";

const rootRoute = createRootRoute({ component: Root });

const routeTree = rootRoute.addChildren([
    createRoute({
        getParentRoute: () => rootRoute,
        path: "/",
        component: Home,
    }),
]);

const basepath = import.meta.env.BASE_URL.replace(/\/$/, "") || undefined;

export const router = createRouter({
    routeTree,
    ...(basepath && basepath !== "" ? { basepath } : {}),
});

declare module "@tanstack/react-router" {
    interface Register {
        router: typeof router;
    }
}

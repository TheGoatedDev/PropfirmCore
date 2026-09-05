import {
    createRootRoute,
    createRoute,
    createRouter,
} from "@tanstack/react-router";
import { Account } from "./routes/account.tsx";
import { Home } from "./routes/home.tsx";
import { Root } from "./routes/root.tsx";
import { Signup } from "./routes/signup.tsx";

const rootRoute = createRootRoute({ component: Root });

const routeTree = rootRoute.addChildren([
    createRoute({
        getParentRoute: () => rootRoute,
        path: "/",
        component: Home,
    }),
    createRoute({
        getParentRoute: () => rootRoute,
        path: "/signup",
        component: Signup,
    }),
    createRoute({
        getParentRoute: () => rootRoute,
        path: "/trading-accounts/$id",
        component: Account,
    }),
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
    interface Register {
        router: typeof router;
    }
}

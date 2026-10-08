import { hasPermission, type Permissions } from "@propfirmcore/access";
import { redirect } from "@tanstack/react-router";
import { Route as AppRoute } from "./routes/_app.tsx";

type Me = { permissions: Permissions };

export function useMe() {
    return AppRoute.useRouteContext().me;
}

/** The server checks again; this only hides what would be refused. */
export function useCan() {
    const { me } = AppRoute.useRouteContext();
    return (resource: string, action: string) =>
        hasPermission(me.permissions, resource, action);
}

/** Route `beforeLoad`: send users without the Permission home. */
export function requires(resource: string, action: string) {
    return ({ context }: { context: { me: Me } }) => {
        if (!hasPermission(context.me.permissions, resource, action)) {
            throw redirect({ to: "/" });
        }
    };
}

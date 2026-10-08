import {
    type Action,
    hasPermission,
    type Permissions,
    type Resource,
    within,
} from "@propfirmcore/access";
import { useQuery } from "@tanstack/react-query";
import { redirect } from "@tanstack/react-router";
import { fetchRoles, keys } from "./api.ts";
import { Route as AppRoute } from "./routes/_app.tsx";

type Me = { permissions: Permissions };

export function useMe() {
    return AppRoute.useRouteContext().me;
}

/** The server checks again; this only hides what would be refused. */
export function useCan() {
    const { me } = AppRoute.useRouteContext();
    return <R extends Resource>(resource: R, action: Action<R>) =>
        hasPermission(me.permissions, resource, action);
}

/** Route `beforeLoad`: send users without the Permission home. */
export function requires<R extends Resource>(resource: R, action: Action<R>) {
    return ({ context }: { context: { me: Me } }) => {
        if (!hasPermission(context.me.permissions, resource, action)) {
            throw redirect({ to: "/" });
        }
    };
}

/** Roles this user may hand out: within their own. */
export function useAssignableRoles(): string[] {
    const me = useMe();
    const roles = useQuery({ queryKey: keys.roles, queryFn: fetchRoles });
    return (roles.data ?? [])
        .filter((r) => within(r.permissions, me.permissions))
        .map((r) => r.name);
}

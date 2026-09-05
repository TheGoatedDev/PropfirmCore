import { AppShell, SidebarItem } from "@propfirmcore/ui/components/app-shell";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
    createRootRoute,
    Link,
    Outlet,
    useMatches,
    useNavigate,
} from "@tanstack/react-router";
import { House } from "lucide-react";
import { authPost, fetchMe, keys } from "../api.ts";
import { useUi } from "../stores/ui.ts";

export const Route = createRootRoute({ component: Root });

function Breadcrumbs() {
    const crumbs = useMatches().filter((m) => m.staticData.crumb);
    if (crumbs.length < 2) return null;
    return (
        <nav aria-label="Breadcrumb">
            <ol className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
                {crumbs.map((m, i) => {
                    const last = i === crumbs.length - 1;
                    return (
                        <li key={m.id} className="flex items-center gap-1">
                            {i > 0 ? <span aria-hidden>/</span> : null}
                            {last ? (
                                <span
                                    className="text-foreground"
                                    aria-current="page"
                                >
                                    {m.staticData.crumb}
                                </span>
                            ) : (
                                <Link
                                    to={m.pathname}
                                    className="hover:underline"
                                >
                                    {m.staticData.crumb}
                                </Link>
                            )}
                        </li>
                    );
                })}
            </ol>
        </nav>
    );
}

function Root() {
    const me = useQuery({ queryKey: keys.me, queryFn: fetchMe, retry: false });
    const error = useUi((s) => s.error);
    const qc = useQueryClient();
    const navigate = useNavigate();

    async function signOut() {
        await authPost("/auth/sign-out");
        qc.setQueryData(keys.me, null);
        await navigate({ to: "/" });
    }

    return (
        <AppShell
            title="Trader"
            user={me.data}
            error={error}
            onSignOut={me.data ? () => void signOut() : undefined}
            logo={
                <Link to="/" className="text-lg font-semibold">
                    Trader
                </Link>
            }
            sidebar={
                <nav aria-label="Main" className="space-y-1">
                    <Link
                        to="/"
                        className="block rounded-lg px-2 py-1.5 text-sm hover:bg-muted"
                    >
                        <SidebarItem icon={<House />}>Home</SidebarItem>
                    </Link>
                </nav>
            }
            breadcrumb={me.data ? <Breadcrumbs /> : undefined}
        >
            {me.isLoading ? <p>Loading</p> : <Outlet />}
        </AppShell>
    );
}

import { AppShell } from "@propfirmcore/ui/components/app-shell";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
    createRootRoute,
    Link,
    Outlet,
    useNavigate,
} from "@tanstack/react-router";
import { authPost, fetchMe, keys } from "../api.ts";
import { useUi } from "../stores/ui.ts";

export const Route = createRootRoute({ component: Root });

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
                        Home
                    </Link>
                </nav>
            }
        >
            {me.isLoading ? <p>Loading</p> : <Outlet />}
        </AppShell>
    );
}

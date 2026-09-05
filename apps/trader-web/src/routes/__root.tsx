import { AppShell } from "@propfirmcore/ui/components/app-shell";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createRootRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { authPost, fetchMe, keys } from "../api.ts";
import { useUi } from "../stores/ui.ts";

export const Route = createRootRoute({ component: Root });

function Root() {
    const me = useQuery({ queryKey: keys.me, queryFn: fetchMe, retry: false });
    const error = useUi((s) => s.error);
    const qc = useQueryClient();
    const navigate = useNavigate();

    if (me.isLoading) return <p className="p-6">Loading</p>;

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
            onSignOut={() => void signOut()}
        >
            <Outlet />
        </AppShell>
    );
}

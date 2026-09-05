import { AppShell, SidebarItem } from "@propfirmcore/ui/components/app-shell";
import { useQueryClient } from "@tanstack/react-query";
import {
    createFileRoute,
    Link,
    Outlet,
    redirect,
    useMatches,
    useNavigate,
} from "@tanstack/react-router";
import { House } from "lucide-react";
import { authPost, failMsg, fetchMe, keys } from "../api.ts";
import { useUi } from "../stores/ui.ts";

export const Route = createFileRoute("/_app")({
    beforeLoad: async ({ context }) => {
        const me = await context.queryClient.query({
            queryKey: keys.me,
            queryFn: fetchMe,
            staleTime: "static",
        });
        if (!me) throw redirect({ to: "/signin" });
        return { me };
    },
    pendingComponent: Pending,
    component: App,
});

function Pending() {
    return <p>Loading</p>;
}

function App() {
    const { me } = Route.useRouteContext();
    const error = useUi((s) => s.error);
    const setError = useUi((s) => s.setError);
    const qc = useQueryClient();
    const navigate = useNavigate();
    const matches = useMatches();

    const crumbs = matches
        .filter((m) => m.staticData.crumb)
        .map((m) => ({
            label: m.staticData.crumb ?? "",
            to: m.pathname,
        }));

    async function signOut() {
        await qc.cancelQueries({ queryKey: keys.me });
        const { error } = await authPost("/auth/sign-out", {});
        if (error) {
            setError(failMsg(error, "Sign out failed"));
            return;
        }
        qc.setQueryData(keys.me, null);
        await navigate({ to: "/signin" });
    }

    return (
        <AppShell
            title="Trader"
            user={me}
            error={error}
            onSignOut={() => void signOut()}
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
            crumbs={crumbs}
            onCrumb={(to) => void navigate({ to })}
        >
            <Outlet />
        </AppShell>
    );
}

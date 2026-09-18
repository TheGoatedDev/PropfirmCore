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
import {
    Building2,
    Cable,
    CreditCard,
    House,
    Landmark,
    Package,
    Users,
    Wallet,
} from "lucide-react";
import { authPost, failMsg, fetchMe, keys } from "../api.ts";
import { useUi } from "../stores/ui.ts";

export const Route = createFileRoute("/_app")({
    beforeLoad: async ({ context }) => {
        const me = await context.queryClient.query({
            queryKey: keys.me,
            queryFn: fetchMe,
            staleTime: "static",
        });
        if (me?.role !== "admin") throw redirect({ to: "/signin" });
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
            title="Admin"
            user={me}
            error={error}
            onSignOut={() => void signOut()}
            logo={
                <Link
                    to="/"
                    className="flex items-center gap-2 text-lg font-semibold"
                >
                    <Building2 className="size-5" />
                    Admin
                </Link>
            }
            sidebar={
                <nav aria-label="Main" className="space-y-1">
                    <Link
                        to="/"
                        className="block rounded-lg px-2 py-1.5 text-sm hover:bg-muted"
                        data-testid="nav-home"
                    >
                        <SidebarItem icon={<House />}>Home</SidebarItem>
                    </Link>
                    <Link
                        to="/firm"
                        className="block rounded-lg px-2 py-1.5 text-sm hover:bg-muted"
                        data-testid="nav-firm"
                    >
                        <SidebarItem icon={<Building2 />}>Firm</SidebarItem>
                    </Link>
                    <Link
                        to="/brokers"
                        className="block rounded-lg px-2 py-1.5 text-sm hover:bg-muted"
                        data-testid="nav-brokers"
                    >
                        <SidebarItem icon={<Cable />}>Brokers</SidebarItem>
                    </Link>
                    <Link
                        to="/products"
                        className="block rounded-lg px-2 py-1.5 text-sm hover:bg-muted"
                        data-testid="nav-products"
                    >
                        <SidebarItem icon={<Package />}>Products</SidebarItem>
                    </Link>
                    <Link
                        to="/payments"
                        className="block rounded-lg px-2 py-1.5 text-sm hover:bg-muted"
                        data-testid="nav-payments"
                    >
                        <SidebarItem icon={<CreditCard />}>
                            Payments
                        </SidebarItem>
                    </Link>
                    <Link
                        to="/payouts"
                        className="block rounded-lg px-2 py-1.5 text-sm hover:bg-muted"
                        data-testid="nav-payouts"
                    >
                        <SidebarItem icon={<Landmark />}>Payouts</SidebarItem>
                    </Link>
                    <Link
                        to="/trading-accounts"
                        className="block rounded-lg px-2 py-1.5 text-sm hover:bg-muted"
                        data-testid="nav-trading-accounts"
                    >
                        <SidebarItem icon={<Wallet />}>
                            Trading accounts
                        </SidebarItem>
                    </Link>
                    <Link
                        to="/users"
                        className="block rounded-lg px-2 py-1.5 text-sm hover:bg-muted"
                        data-testid="nav-users"
                    >
                        <SidebarItem icon={<Users />}>Users</SidebarItem>
                    </Link>
                </nav>
            }
            crumbs={matches
                .filter((m) => m.staticData.crumb)
                .map((m) => ({
                    label: m.staticData.crumb ?? "",
                    to: m.pathname,
                }))}
            onCrumb={(to) => void navigate({ to })}
        >
            <Outlet />
        </AppShell>
    );
}

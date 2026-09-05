import { Alert, AlertDescription } from "@propfirmcore/ui/components/alert";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { fetchMe, keys } from "../api.ts";
import { useUi } from "../stores/ui.ts";

export const Route = createFileRoute("/_guest")({
    beforeLoad: async ({ context }) => {
        const me = await context.queryClient.query({
            queryKey: keys.me,
            queryFn: fetchMe,
            staleTime: "static",
        });
        if (me?.role === "admin") throw redirect({ to: "/" });
        return { me };
    },
    pendingComponent: Pending,
    component: Guest,
});

function Pending() {
    return <p>Loading</p>;
}

function Guest() {
    const { me } = Route.useRouteContext();
    const error = useUi((s) => s.error);
    if (me) return <p>not admin</p>;
    return (
        <div className="min-h-svh space-y-6 p-6">
            {error ? (
                <Alert>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            ) : null}
            <Outlet />
        </div>
    );
}

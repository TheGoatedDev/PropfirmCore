import { Alert, AlertDescription } from "@propfirmcore/ui/components/alert";
import { Button } from "@propfirmcore/ui/components/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Outlet, useNavigate } from "@tanstack/react-router";
import { authPost, fetchMe, keys } from "../api.ts";
import { useUi } from "../stores/ui.ts";

export function Root() {
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
        <div className="mx-auto max-w-3xl space-y-6 p-6">
            <header className="flex items-center justify-between">
                <h1 className="text-xl font-semibold">Trader</h1>
                {me.data ? (
                    <div className="flex items-center gap-3">
                        <span className="text-sm text-muted-foreground">
                            {me.data.email}
                        </span>
                        <Button
                            variant="outline"
                            onClick={() => void signOut()}
                        >
                            Sign out
                        </Button>
                    </div>
                ) : null}
            </header>
            {error ? (
                <Alert>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            ) : null}
            <Outlet />
        </div>
    );
}

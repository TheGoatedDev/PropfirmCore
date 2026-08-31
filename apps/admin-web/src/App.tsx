import { Alert, AlertDescription } from "@propfirmcore/ui/components/alert";
import { Badge } from "@propfirmcore/ui/components/badge";
import { Button } from "@propfirmcore/ui/components/button";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@propfirmcore/ui/components/card";
import { Input } from "@propfirmcore/ui/components/input";
import { Label } from "@propfirmcore/ui/components/label";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@propfirmcore/ui/components/table";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import { api, authPost } from "./api.ts";

type Me = { id: string; email: string; role: string };
type TradingAccount = {
    id: string;
    userId: string | null;
    productId: string;
    status: string;
    equity: number;
};

function basePath() {
    return import.meta.env.BASE_URL.replace(/\/$/, "");
}

function go(path: string) {
    window.history.pushState({}, "", `${basePath()}${path}`);
    window.dispatchEvent(new PopStateEvent("popstate"));
}

export function App() {
    const [me, setMe] = useState<Me | null>(null);
    const [ready, setReady] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refreshMe = useCallback(async () => {
        const { data } = await api.GET("/me");
        setMe(data ?? null);
        setReady(true);
    }, []);

    useEffect(() => {
        void refreshMe();
    }, [refreshMe]);

    async function signOut() {
        await authPost("/auth/sign-out");
        setMe(null);
        go("/");
    }

    if (!ready) return <p className="p-6">Loading</p>;

    return (
        <div className="mx-auto max-w-3xl space-y-6 p-6">
            <header className="flex items-center justify-between">
                <h1 className="text-xl font-semibold">Admin</h1>
                {me ? (
                    <div className="flex items-center gap-3">
                        <span className="text-sm text-muted-foreground">
                            {me.email}
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
            {!me ? (
                <SignIn onDone={() => void refreshMe()} onError={setError} />
            ) : me.role !== "admin" ? (
                <p>not admin</p>
            ) : (
                <AdminHome onError={setError} />
            )}
        </div>
    );
}

function SignIn({
    onDone,
    onError,
}: {
    onDone: () => void;
    onError: (msg: string | null) => void;
}) {
    async function submit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        onError(null);
        const fd = new FormData(e.currentTarget);
        const { error } = await authPost("/auth/sign-in/email", {
            email: String(fd.get("email") ?? ""),
            password: String(fd.get("password") ?? ""),
        });
        if (error) {
            onError(
                error && typeof error === "object" && "message" in error
                    ? String(error.message)
                    : "Sign in failed",
            );
            return;
        }
        onDone();
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Sign in</CardTitle>
            </CardHeader>
            <CardContent>
                <form className="space-y-3" onSubmit={(e) => void submit(e)}>
                    <div className="space-y-1">
                        <Label htmlFor="email">Email</Label>
                        <Input id="email" name="email" type="email" required />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="password">Password</Label>
                        <Input
                            id="password"
                            name="password"
                            type="password"
                            required
                        />
                    </div>
                    <Button type="submit">Sign in</Button>
                </form>
            </CardContent>
        </Card>
    );
}

function AdminHome({ onError }: { onError: (msg: string | null) => void }) {
    const [accounts, setAccounts] = useState<TradingAccount[]>([]);

    const load = useCallback(async () => {
        const { data } = await api.GET("/trading-accounts");
        setAccounts(data ?? []);
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    async function complete(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        onError(null);
        const id = String(new FormData(e.currentTarget).get("paymentId") ?? "");
        const { error } = await api.POST("/payments/{id}/complete", {
            params: { path: { id } },
        });
        if (error) {
            onError("error" in error ? String(error.error) : "Complete failed");
            return;
        }
        await load();
    }

    async function force(id: string, action: "pass" | "fail") {
        onError(null);
        const path =
            action === "pass"
                ? "/trading-accounts/{id}/pass"
                : "/trading-accounts/{id}/fail";
        const { error } = await api.POST(path, { params: { path: { id } } });
        if (error) {
            onError(
                "error" in error ? String(error.error) : `${action} failed`,
            );
            return;
        }
        await load();
    }

    return (
        <>
            <section>
                <h2 className="mb-3 text-lg font-medium">Complete payment</h2>
                <form
                    className="flex items-end gap-3"
                    onSubmit={(e) => void complete(e)}
                >
                    <div className="space-y-1">
                        <Label htmlFor="paymentId">Payment ID</Label>
                        <Input id="paymentId" name="paymentId" required />
                    </div>
                    <Button type="submit">Complete</Button>
                </form>
            </section>
            <section>
                <h2 className="mb-3 text-lg font-medium">Trading accounts</h2>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>ID</TableHead>
                            <TableHead>User</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead />
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {accounts.map((a) => (
                            <TableRow key={a.id}>
                                <TableCell>{a.id}</TableCell>
                                <TableCell>{a.userId}</TableCell>
                                <TableCell>
                                    <Badge>{a.status}</Badge>
                                </TableCell>
                                <TableCell className="space-x-2">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => void force(a.id, "pass")}
                                    >
                                        Pass
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="destructive"
                                        onClick={() => void force(a.id, "fail")}
                                    >
                                        Fail
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </section>
        </>
    );
}

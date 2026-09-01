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
type Product = { id: string; name: string; phases: { fee: number }[] };
type TradingAccount = {
    id: string;
    productId: string;
    status: string;
    equity: number;
    balance: number;
};
type Fill = {
    externalId: string;
    symbol: string;
    qty: number;
    price: number;
    side: string;
    ts: string;
};
type Snapshot = {
    externalId: string;
    equity: number;
    balance: number;
    ts: string;
};
type Payout = {
    id: string;
    amount: number;
    status: string;
    reason: string | null;
};

function pathNow() {
    return window.location.pathname;
}

function authError(error: unknown, fallback: string) {
    if (error && typeof error === "object" && "message" in error) {
        return String(error.message);
    }
    return fallback;
}

function go(path: string) {
    window.history.pushState({}, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
}

export function App() {
    const [path, setPath] = useState(pathNow);
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
        const onPop = () => setPath(pathNow());
        window.addEventListener("popstate", onPop);
        return () => window.removeEventListener("popstate", onPop);
    }, [refreshMe]);

    async function signOut() {
        await authPost("/auth/sign-out");
        setMe(null);
        go("/");
    }

    if (!ready) return <p className="p-6">Loading</p>;

    const accountId = path.startsWith("/trading-accounts/")
        ? path.slice("/trading-accounts/".length)
        : null;

    return (
        <div className="mx-auto max-w-3xl space-y-6 p-6">
            <header className="flex items-center justify-between">
                <h1 className="text-xl font-semibold">Trader</h1>
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
            {!me && path === "/signup" ? (
                <AuthForm
                    mode="signup"
                    onDone={() => void refreshMe().then(() => go("/"))}
                    onError={setError}
                />
            ) : !me ? (
                <AuthForm
                    mode="signin"
                    onDone={() => void refreshMe()}
                    onError={setError}
                />
            ) : accountId ? (
                <AccountDetail id={accountId} onError={setError} />
            ) : (
                <Home onError={setError} />
            )}
        </div>
    );
}

function AuthForm({
    mode,
    onDone,
    onError,
}: {
    mode: "signin" | "signup";
    onDone: () => void;
    onError: (msg: string | null) => void;
}) {
    async function submit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        onError(null);
        const fd = new FormData(e.currentTarget);
        const email = String(fd.get("email") ?? "");
        const password = String(fd.get("password") ?? "");
        if (mode === "signup") {
            const name = String(fd.get("name") ?? "");
            const { error } = await authPost("/auth/sign-up/email", {
                name,
                email,
                password,
            });
            if (error) {
                onError(authError(error, "Sign up failed"));
                return;
            }
        } else {
            const { error } = await authPost("/auth/sign-in/email", {
                email,
                password,
            });
            if (error) {
                onError(authError(error, "Sign in failed"));
                return;
            }
        }
        onDone();
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>
                    {mode === "signup" ? "Sign up" : "Sign in"}
                </CardTitle>
            </CardHeader>
            <CardContent>
                <form className="space-y-3" onSubmit={(e) => void submit(e)}>
                    {mode === "signup" ? (
                        <div className="space-y-1">
                            <Label htmlFor="name">Name</Label>
                            <Input id="name" name="name" required />
                        </div>
                    ) : null}
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
                    <Button type="submit">
                        {mode === "signup" ? "Sign up" : "Sign in"}
                    </Button>
                </form>
                {mode === "signin" ? (
                    <p className="mt-3 text-sm">
                        <button
                            type="button"
                            className="underline"
                            onClick={() => go("/signup")}
                        >
                            Sign up
                        </button>
                    </p>
                ) : (
                    <p className="mt-3 text-sm">
                        <button
                            type="button"
                            className="underline"
                            onClick={() => go("/")}
                        >
                            Sign in
                        </button>
                    </p>
                )}
            </CardContent>
        </Card>
    );
}

function Home({ onError }: { onError: (msg: string | null) => void }) {
    const [products, setProducts] = useState<Product[]>([]);
    const [accounts, setAccounts] = useState<TradingAccount[]>([]);
    const [paymentId, setPaymentId] = useState<string | null>(null);

    const load = useCallback(async () => {
        const [p, a] = await Promise.all([
            api.GET("/products"),
            api.GET("/trading-accounts"),
        ]);
        setProducts((p.data as Product[] | undefined) ?? []);
        setAccounts(a.data ?? []);
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    async function buy(id: string) {
        onError(null);
        const { data, error } = await api.POST("/products/{id}/buy", {
            params: { path: { id } },
        });
        if (error) {
            onError("error" in error ? String(error.error) : "Buy failed");
            return;
        }
        if (data?.payment?.id) setPaymentId(data.payment.id);
        await load();
    }

    return (
        <>
            <section>
                <h2 className="mb-3 text-lg font-medium">Products</h2>
                {paymentId ? <p>Payment ID: {paymentId}</p> : null}
                <div className="space-y-3">
                    {products.map((p) => (
                        <Card key={p.id}>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <CardTitle>{p.name}</CardTitle>
                                <Button onClick={() => void buy(p.id)}>
                                    Buy
                                </Button>
                            </CardHeader>
                        </Card>
                    ))}
                </div>
            </section>
            <section>
                <h2 className="mb-3 text-lg font-medium">Trading accounts</h2>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>ID</TableHead>
                            <TableHead>Product</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Equity</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {accounts.map((a) => (
                            <TableRow
                                key={a.id}
                                className="cursor-pointer"
                                onClick={() => go(`/trading-accounts/${a.id}`)}
                            >
                                <TableCell>{a.id}</TableCell>
                                <TableCell>{a.productId}</TableCell>
                                <TableCell>
                                    <Badge>{a.status}</Badge>
                                </TableCell>
                                <TableCell>{a.equity}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </section>
        </>
    );
}

function AccountDetail({
    id,
    onError,
}: {
    id: string;
    onError: (msg: string | null) => void;
}) {
    const [account, setAccount] = useState<TradingAccount | null>(null);
    const [fills, setFills] = useState<Fill[]>([]);
    const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
    const [payouts, setPayouts] = useState<Payout[]>([]);

    const load = useCallback(async () => {
        onError(null);
        const [a, f, s, p] = await Promise.all([
            api.GET("/trading-accounts/{id}", { params: { path: { id } } }),
            api.GET("/trading-accounts/{id}/fills", {
                params: { path: { id } },
            }),
            api.GET("/trading-accounts/{id}/snapshots", {
                params: { path: { id } },
            }),
            api.GET("/trading-accounts/{id}/payouts", {
                params: { path: { id } },
            }),
        ]);
        if (a.error) {
            onError("error" in a.error ? String(a.error.error) : "Not found");
            return;
        }
        setAccount(a.data ?? null);
        setFills((f.data as Fill[] | undefined) ?? []);
        setSnapshots((s.data as Snapshot[] | undefined) ?? []);
        setPayouts((p.data as Payout[] | undefined) ?? []);
    }, [id, onError]);

    useEffect(() => {
        void load();
    }, [load]);

    async function requestPayout(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        onError(null);
        const amount = Number(new FormData(e.currentTarget).get("amount"));
        const { error } = await api.POST("/trading-accounts/{id}/payouts", {
            params: { path: { id } },
            body: { amount },
        });
        if (error) {
            onError("error" in error ? String(error.error) : "Payout failed");
            return;
        }
        await load();
    }

    if (!account) return <p>Loading</p>;

    return (
        <div className="space-y-4">
            <Button variant="outline" onClick={() => go("/")}>
                Back
            </Button>
            <Card>
                <CardHeader>
                    <CardTitle>{account.id}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                    <p>Status: {account.status}</p>
                    <p>Equity: {account.equity}</p>
                    <p>Balance: {account.balance}</p>
                </CardContent>
            </Card>
            {account.status === "funded" ? (
                <form
                    className="flex items-end gap-3"
                    onSubmit={(e) => void requestPayout(e)}
                >
                    <div className="space-y-1">
                        <Label htmlFor="amount">Payout amount</Label>
                        <Input
                            id="amount"
                            name="amount"
                            type="number"
                            min="0"
                            step="any"
                            required
                        />
                    </div>
                    <Button type="submit">Request</Button>
                </form>
            ) : null}
            <h3 className="font-medium">Payouts</h3>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {payouts.map((p) => (
                        <TableRow key={p.id}>
                            <TableCell>{p.id}</TableCell>
                            <TableCell>{p.amount}</TableCell>
                            <TableCell>
                                <Badge>{p.status}</Badge>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
            <h3 className="font-medium">Fills</h3>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Symbol</TableHead>
                        <TableHead>Side</TableHead>
                        <TableHead>Qty</TableHead>
                        <TableHead>Price</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {fills.map((f) => (
                        <TableRow key={f.externalId}>
                            <TableCell>{f.symbol}</TableCell>
                            <TableCell>{f.side}</TableCell>
                            <TableCell>{f.qty}</TableCell>
                            <TableCell>{f.price}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
            <h3 className="font-medium">Snapshots</h3>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Equity</TableHead>
                        <TableHead>Balance</TableHead>
                        <TableHead>Time</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {snapshots.map((s) => (
                        <TableRow key={s.externalId}>
                            <TableCell>{s.equity}</TableCell>
                            <TableCell>{s.balance}</TableCell>
                            <TableCell>{s.ts}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}

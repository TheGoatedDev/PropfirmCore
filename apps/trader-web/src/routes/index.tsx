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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { z } from "zod";
import { api, authPost, failMsg, fetchMe, keys } from "../api.ts";
import { useUi } from "../stores/ui.ts";

const signInSchema = z.object({
    email: z.email(),
    password: z.string().min(1),
});

type Product = { id: string; name: string };

export const Route = createFileRoute("/")({
    component: Home,
    staticData: { crumb: "Home" },
});

function Home() {
    const me = useQuery({ queryKey: keys.me, queryFn: fetchMe, retry: false });
    if (!me.data) return <SignIn />;
    return <Dashboard />;
}

function SignIn() {
    const setError = useUi((s) => s.setError);
    const qc = useQueryClient();

    async function submit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setError(null);
        const fd = new FormData(e.currentTarget);
        const parsed = signInSchema.safeParse({
            email: String(fd.get("email") ?? ""),
            password: String(fd.get("password") ?? ""),
        });
        if (!parsed.success) {
            setError(parsed.error.issues[0]?.message ?? "Invalid");
            return;
        }
        const { error } = await authPost("/auth/sign-in/email", parsed.data);
        if (error) {
            setError(failMsg(error, "Sign in failed"));
            return;
        }
        await qc.invalidateQueries({ queryKey: keys.me });
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
                <p className="mt-3 text-sm">
                    <Link to="/signup" className="underline">
                        Sign up
                    </Link>
                </p>
            </CardContent>
        </Card>
    );
}

function Dashboard() {
    const setError = useUi((s) => s.setError);
    const qc = useQueryClient();
    const navigate = useNavigate();
    const [paymentId, setPaymentId] = useState<string | null>(null);

    const products = useQuery({
        queryKey: keys.products,
        queryFn: async () => {
            const { data, error } = await api.GET("/products");
            if (error) throw error;
            return (data ?? []) as Product[];
        },
    });
    const accounts = useQuery({
        queryKey: keys.accounts,
        queryFn: async () => {
            const { data, error } = await api.GET("/trading-accounts");
            if (error) throw error;
            return data ?? [];
        },
    });

    const buy = useMutation({
        mutationFn: async (id: string) => {
            const { data, error } = await api.POST("/products/{id}/buy", {
                params: { path: { id } },
            });
            if (error) throw error;
            return data;
        },
        onSuccess: async (data) => {
            if (data && "payment" in data && data.payment?.id) {
                setPaymentId(data.payment.id);
            }
            await qc.invalidateQueries({ queryKey: keys.accounts });
        },
        onError: (error) => setError(failMsg(error, "Buy failed")),
    });

    return (
        <>
            <section>
                <h2 className="mb-3 text-lg font-medium">Products</h2>
                {paymentId ? <p>Payment ID: {paymentId}</p> : null}
                <div className="space-y-3">
                    {(products.data ?? []).map((p) => (
                        <Card key={p.id}>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <CardTitle>{p.name}</CardTitle>
                                <Button
                                    onClick={() => {
                                        setError(null);
                                        buy.mutate(p.id);
                                    }}
                                >
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
                        {(accounts.data ?? []).map((a) => (
                            <TableRow
                                key={a.id}
                                className="cursor-pointer"
                                onClick={() =>
                                    void navigate({
                                        to: "/trading-accounts/$id",
                                        params: { id: a.id },
                                    })
                                }
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

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
import type { FormEvent } from "react";
import { z } from "zod";
import { api, authPost, failMsg, fetchMe, keys } from "../api.ts";
import { useUi } from "../stores/ui.ts";

const signInSchema = z.object({
    email: z.email(),
    password: z.string().min(1),
});
const paymentIdSchema = z.object({ paymentId: z.string().min(1) });

export function Home() {
    const me = useQuery({ queryKey: keys.me, queryFn: fetchMe, retry: false });
    if (!me.data) return <SignIn />;
    if (me.data.role !== "admin") return <p>not admin</p>;
    return <AdminHome />;
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
            </CardContent>
        </Card>
    );
}

function AdminHome() {
    const setError = useUi((s) => s.setError);
    const qc = useQueryClient();

    const accounts = useQuery({
        queryKey: keys.accounts,
        queryFn: async () => {
            const { data, error } = await api.GET("/trading-accounts");
            if (error) throw error;
            return data ?? [];
        },
    });
    const payouts = useQuery({
        queryKey: keys.payouts,
        queryFn: async () => {
            const { data, error } = await api.GET("/payouts");
            if (error) throw error;
            return data ?? [];
        },
    });

    async function invalidate() {
        await Promise.all([
            qc.invalidateQueries({ queryKey: keys.accounts }),
            qc.invalidateQueries({ queryKey: keys.payouts }),
        ]);
    }

    const complete = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await api.POST("/payments/{id}/complete", {
                params: { path: { id } },
            });
            if (error) throw error;
        },
        onSuccess: invalidate,
        onError: (error) => setError(failMsg(error, "Complete failed")),
    });

    const payoutAct = useMutation({
        mutationFn: async (input: {
            id: string;
            action: "approve" | "reject" | "pay";
        }) => {
            const path =
                input.action === "approve"
                    ? "/payouts/{id}/approve"
                    : input.action === "reject"
                      ? "/payouts/{id}/reject"
                      : "/payouts/{id}/pay";
            const { error } = await api.POST(path, {
                params: { path: { id: input.id } },
            });
            if (error) throw error;
        },
        onSuccess: invalidate,
        onError: (error) => setError(failMsg(error, "Action failed")),
    });

    const force = useMutation({
        mutationFn: async (input: { id: string; action: "pass" | "fail" }) => {
            const path =
                input.action === "pass"
                    ? "/trading-accounts/{id}/pass"
                    : "/trading-accounts/{id}/fail";
            const { error } = await api.POST(path, {
                params: { path: { id: input.id } },
            });
            if (error) throw error;
        },
        onSuccess: invalidate,
        onError: (error) => setError(failMsg(error, "Action failed")),
    });

    async function submitComplete(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setError(null);
        const parsed = paymentIdSchema.safeParse({
            paymentId: String(
                new FormData(e.currentTarget).get("paymentId") ?? "",
            ),
        });
        if (!parsed.success) {
            setError(parsed.error.issues[0]?.message ?? "Invalid");
            return;
        }
        complete.mutate(parsed.data.paymentId);
    }

    return (
        <>
            <section>
                <h2 className="mb-3 text-lg font-medium">Complete payment</h2>
                <form
                    className="flex items-end gap-3"
                    onSubmit={(e) => void submitComplete(e)}
                >
                    <div className="space-y-1">
                        <Label htmlFor="paymentId">Payment ID</Label>
                        <Input id="paymentId" name="paymentId" required />
                    </div>
                    <Button type="submit">Complete</Button>
                </form>
            </section>
            <section>
                <h2 className="mb-3 text-lg font-medium">Payouts</h2>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>ID</TableHead>
                            <TableHead>Account</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead />
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {(payouts.data ?? []).map((p) => (
                            <TableRow key={p.id}>
                                <TableCell>{p.id}</TableCell>
                                <TableCell>{p.tradingAccountId}</TableCell>
                                <TableCell>{p.amount}</TableCell>
                                <TableCell>
                                    <Badge>{p.status}</Badge>
                                </TableCell>
                                <TableCell className="space-x-2">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                            setError(null);
                                            payoutAct.mutate({
                                                id: p.id,
                                                action: "approve",
                                            });
                                        }}
                                    >
                                        Approve
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                            setError(null);
                                            payoutAct.mutate({
                                                id: p.id,
                                                action: "reject",
                                            });
                                        }}
                                    >
                                        Reject
                                    </Button>
                                    <Button
                                        size="sm"
                                        onClick={() => {
                                            setError(null);
                                            payoutAct.mutate({
                                                id: p.id,
                                                action: "pay",
                                            });
                                        }}
                                    >
                                        Mark paid
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
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
                        {(accounts.data ?? []).map((a) => (
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
                                        onClick={() => {
                                            setError(null);
                                            force.mutate({
                                                id: a.id,
                                                action: "pass",
                                            });
                                        }}
                                    >
                                        Pass
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="destructive"
                                        onClick={() => {
                                            setError(null);
                                            force.mutate({
                                                id: a.id,
                                                action: "fail",
                                            });
                                        }}
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

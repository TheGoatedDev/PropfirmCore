import { Badge } from "@propfirmcore/ui/components/badge";
import { Button } from "@propfirmcore/ui/components/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@propfirmcore/ui/components/table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { api, failMsg, keys } from "../../api.ts";
import { useUi } from "../../stores/ui.ts";

export const Route = createFileRoute("/_app/payouts")({
    component: Payouts,
    staticData: { crumb: "Payouts" },
});

function Payouts() {
    const setError = useUi((s) => s.setError);
    const qc = useQueryClient();
    const payouts = useQuery({
        queryKey: keys.payouts,
        queryFn: async () => {
            const { data, error } = await api.GET("/payouts");
            if (error) throw error;
            return data ?? [];
        },
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
        onSuccess: async () => {
            await qc.invalidateQueries({ queryKey: keys.payouts });
        },
        onError: (error) => setError(failMsg(error, "Action failed")),
    });

    return (
        <section>
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
    );
}

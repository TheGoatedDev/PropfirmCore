import { Button } from "@propfirmcore/ui/components/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@propfirmcore/ui/components/card";
import { DescriptionList } from "@propfirmcore/ui/components/description-list";
import { Input } from "@propfirmcore/ui/components/input";
import { Label } from "@propfirmcore/ui/components/label";
import {
    EmptyNote,
    PageSection,
} from "@propfirmcore/ui/components/page-section";
import { useShowMore } from "@propfirmcore/ui/components/show-more";
import { StatusBadge } from "@propfirmcore/ui/components/status-badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@propfirmcore/ui/components/table";
import {
    formatAmount,
    formatDateTime,
    formatEnum,
    formatPercent,
} from "@propfirmcore/ui/lib/format";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import type { FormEvent } from "react";
import { z } from "zod";
import { api, failMsg, keys } from "../../api.ts";
import { useUi } from "../../stores/ui.ts";

const payoutSchema = z.object({ amount: z.coerce.number().positive() });

type Product = {
    id: string;
    name: string;
    phases: { name: string; kind: string }[];
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

const ruleLabels: Record<string, string> = {
    weekend: "Weekend",
    maxLot: "Max lot",
    consistency: "Consistency",
};

export const Route = createFileRoute("/_app/trading-accounts/$id")({
    component: Account,
    staticData: { crumb: "Trading account" },
});

function Account() {
    const { id } = Route.useParams();
    return <AccountDetail id={id} />;
}

function AccountDetail({ id }: { id: string }) {
    const setError = useUi((s) => s.setError);
    const qc = useQueryClient();

    const account = useQuery({
        queryKey: keys.account(id),
        queryFn: async () => {
            const { data, error } = await api.GET("/trading-accounts/{id}", {
                params: { path: { id } },
            });
            if (error) throw error;
            return data;
        },
    });
    const fills = useQuery({
        queryKey: keys.fills(id),
        queryFn: async () => {
            const { data, error } = await api.GET(
                "/trading-accounts/{id}/fills",
                { params: { path: { id } } },
            );
            if (error) throw error;
            return (data ?? []) as Fill[];
        },
    });
    const snapshots = useQuery({
        queryKey: keys.snapshots(id),
        queryFn: async () => {
            const { data, error } = await api.GET(
                "/trading-accounts/{id}/snapshots",
                { params: { path: { id } } },
            );
            if (error) throw error;
            return (data ?? []) as Snapshot[];
        },
    });
    const payouts = useQuery({
        queryKey: keys.payouts(id),
        queryFn: async () => {
            const { data, error } = await api.GET(
                "/trading-accounts/{id}/payouts",
                { params: { path: { id } } },
            );
            if (error) throw error;
            return data ?? [];
        },
    });
    const warnings = useQuery({
        queryKey: keys.breaches(id),
        queryFn: async () => {
            const { data, error } = await api.GET(
                "/trading-accounts/{id}/breaches",
                { params: { path: { id } } },
            );
            if (error) throw error;
            return data ?? [];
        },
    });
    const products = useQuery({
        queryKey: keys.products,
        queryFn: async () => {
            const { data, error } = await api.GET("/products");
            if (error) throw error;
            return (data ?? []) as Product[];
        },
    });

    const requestPayout = useMutation({
        mutationFn: async (amount: number) => {
            const { error } = await api.POST("/trading-accounts/{id}/payouts", {
                params: { path: { id } },
                body: { amount },
            });
            if (error) throw error;
        },
        onSuccess: async () => {
            await Promise.all([
                qc.invalidateQueries({ queryKey: keys.payouts(id) }),
                qc.invalidateQueries({ queryKey: keys.account(id) }),
            ]);
        },
        onError: (error) => setError(failMsg(error, "Payout failed")),
    });

    // ISO timestamps sort lexically; newest first.
    const recentFills = [...(fills.data ?? [])].sort((a, b) =>
        b.ts.localeCompare(a.ts),
    );
    const recentSnapshots = [...(snapshots.data ?? [])].sort((a, b) =>
        b.ts.localeCompare(a.ts),
    );

    if (account.isError) {
        return <EmptyNote>Trading account not found.</EmptyNote>;
    }
    if (!account.data) return <EmptyNote>Loading…</EmptyNote>;

    const acc = account.data;
    const product = products.data?.find((p) => p.id === acc.productId);
    const phase = product?.phases[acc.phaseIndex];
    const funded = acc.status === "active" && phase?.kind === "funded";

    const warned = warnings.data ?? [];
    const max = acc.ruleset.maxWarnings;

    const rules: [string, string][] = [
        ["Profit target", formatPercent(acc.ruleset.profitTarget)],
        ["Max drawdown", formatPercent(acc.ruleset.maxDrawdown)],
        ["Daily drawdown", formatPercent(acc.ruleset.dailyDrawdown)],
        ["Min trading days", String(acc.ruleset.minTradingDays)],
    ];
    if (max !== undefined) rules.push(["Max warnings", String(max)]);

    async function submitPayout(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setError(null);
        const parsed = payoutSchema.safeParse({
            amount: new FormData(e.currentTarget).get("amount"),
        });
        if (!parsed.success) {
            setError(parsed.error.issues[0]?.message ?? "Invalid");
            return;
        }
        requestPayout.mutate(parsed.data.amount);
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex flex-wrap items-center gap-2">
                        {product?.name ?? acc.productId}
                        <StatusBadge status={acc.status} />
                    </CardTitle>
                    <CardDescription>
                        {phase
                            ? `Phase ${acc.phaseIndex + 1} of ${product?.phases.length}: ${phase.name}`
                            : `Phase ${acc.phaseIndex + 1}`}
                    </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-6 md:grid-cols-2">
                    <DescriptionList
                        items={[
                            ["Equity", formatAmount(acc.equity)],
                            ["Balance", formatAmount(acc.balance)],
                            ["Start balance", formatAmount(acc.startBalance)],
                            [
                                "Trading days",
                                `${acc.tradingDays.length} of ${acc.ruleset.minTradingDays}`,
                            ],
                        ]}
                    />
                    <DescriptionList
                        items={[
                            ["Broker", acc.brokerId],
                            ["Login", acc.brokerLogin],
                            ["Password", acc.brokerPassword],
                            ["Account ID", acc.id],
                        ]}
                    />
                </CardContent>
            </Card>
            <PageSection title="Ruleset">
                <DescriptionList items={rules} />
            </PageSection>
            <PageSection title="Warnings">
                <p
                    className="text-sm text-muted-foreground"
                    data-testid="account-warnings-count"
                >
                    {max === undefined
                        ? `${warned.length} ${warned.length === 1 ? "warning" : "warnings"}`
                        : `${warned.length} of ${max} warnings`}
                </p>
                {warned.length > 0 ? (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Rule</TableHead>
                                <TableHead>Phase</TableHead>
                                <TableHead>Time</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {warned.map((w, i) => (
                                <TableRow
                                    key={`${w.phaseIndex}-${w.ruleId}-${w.subjectId}`}
                                    data-testid={`account-warning-${i}`}
                                >
                                    <TableCell>
                                        {ruleLabels[w.ruleId] ??
                                            formatEnum(w.ruleId)}
                                    </TableCell>
                                    <TableCell>{w.phaseIndex + 1}</TableCell>
                                    <TableCell>
                                        {formatDateTime(w.ts)}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                ) : null}
            </PageSection>
            <PageSection title="Payouts">
                {funded ? (
                    <form
                        className="flex items-end gap-3"
                        onSubmit={(e) => void submitPayout(e)}
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
                        <Button
                            type="submit"
                            disabled={requestPayout.isPending}
                        >
                            Request
                        </Button>
                    </form>
                ) : null}
                {(payouts.data ?? []).length === 0 ? (
                    <EmptyNote>No payouts yet.</EmptyNote>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>ID</TableHead>
                                <TableHead className="text-right">
                                    Amount
                                </TableHead>
                                <TableHead>Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {(payouts.data ?? []).map((p) => (
                                <TableRow key={p.id}>
                                    <TableCell>{p.id}</TableCell>
                                    <TableCell className="text-right">
                                        {formatAmount(p.amount)}
                                    </TableCell>
                                    <TableCell>
                                        <StatusBadge status={p.status} />
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </PageSection>
            <FillsSection fills={recentFills} />
            <SnapshotsSection snapshots={recentSnapshots} />
        </div>
    );
}

function FillsSection({ fills }: { fills: Fill[] }) {
    const { visible, footer } = useShowMore(fills);
    return (
        <PageSection title="Fills">
            {fills.length === 0 ? (
                <EmptyNote>No fills yet.</EmptyNote>
            ) : (
                <div>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Symbol</TableHead>
                                <TableHead>Side</TableHead>
                                <TableHead className="text-right">
                                    Qty
                                </TableHead>
                                <TableHead className="text-right">
                                    Price
                                </TableHead>
                                <TableHead>Time</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {visible.map((f) => (
                                <TableRow key={f.externalId}>
                                    <TableCell>{f.symbol}</TableCell>
                                    <TableCell>{formatEnum(f.side)}</TableCell>
                                    <TableCell className="text-right">
                                        {f.qty}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {f.price}
                                    </TableCell>
                                    <TableCell>
                                        {formatDateTime(f.ts)}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                    {footer}
                </div>
            )}
        </PageSection>
    );
}

function SnapshotsSection({ snapshots }: { snapshots: Snapshot[] }) {
    const { visible, footer } = useShowMore(snapshots);
    return (
        <PageSection title="Snapshots">
            {snapshots.length === 0 ? (
                <EmptyNote>No snapshots yet.</EmptyNote>
            ) : (
                <div>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="text-right">
                                    Equity
                                </TableHead>
                                <TableHead className="text-right">
                                    Balance
                                </TableHead>
                                <TableHead>Time</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {visible.map((s) => (
                                <TableRow key={s.externalId}>
                                    <TableCell className="text-right">
                                        {formatAmount(s.equity)}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {formatAmount(s.balance)}
                                    </TableCell>
                                    <TableCell>
                                        {formatDateTime(s.ts)}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                    {footer}
                </div>
            )}
        </PageSection>
    );
}

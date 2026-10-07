import { Button } from "@propfirmcore/ui/components/button";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@propfirmcore/ui/components/card";
import { DescriptionList } from "@propfirmcore/ui/components/description-list";
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
import { CircleCheck, CircleX, RefreshCw } from "lucide-react";
import { api, failMsg, keys } from "../../api.ts";
import { fetchFirm } from "../../firm-api.ts";
import { useUi } from "../../stores/ui.ts";

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

export const Route = createFileRoute("/_app/trading-accounts/$id")({
    component: TradingAccount,
    staticData: { crumb: "Trading account" },
});

function TradingAccount() {
    const { id } = Route.useParams();
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
    const breaches = useQuery({
        queryKey: [...keys.account(id), "breaches"],
        queryFn: async () => {
            const { data, error } = await api.GET(
                "/trading-accounts/{id}/breaches",
                { params: { path: { id } } },
            );
            if (error) throw error;
            return data ?? [];
        },
    });
    const fills = useQuery({
        queryKey: [...keys.account(id), "fills"],
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
        queryKey: [...keys.account(id), "snapshots"],
        queryFn: async () => {
            const { data, error } = await api.GET(
                "/trading-accounts/{id}/snapshots",
                { params: { path: { id } } },
            );
            if (error) throw error;
            return (data ?? []) as Snapshot[];
        },
    });
    const firm = useQuery({ queryKey: keys.firm, queryFn: fetchFirm });

    const act = useMutation({
        mutationFn: async (action: "pass" | "fail" | "resync") => {
            const path =
                action === "pass"
                    ? "/trading-accounts/{id}/pass"
                    : action === "fail"
                      ? "/trading-accounts/{id}/fail"
                      : "/trading-accounts/{id}/resync-ruleset";
            const { error } = await api.POST(path, {
                params: { path: { id } },
            });
            if (error) throw error;
        },
        onSuccess: async () => {
            setError(null);
            await qc.invalidateQueries({ queryKey: keys.accounts });
        },
        onError: (error) => setError(failMsg(error, "Action failed")),
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
    const product = firm.data?.products.find((p) => p.id === acc.productId);
    const phase = product?.phases[acc.phaseIndex];
    const active = acc.status === "active";
    const facts: [string, string | number][] = [
        ["User", acc.userId],
        ["Product", product?.name ?? acc.productId],
        [
            "Phase",
            phase
                ? `${acc.phaseIndex + 1}. ${phase.name} (${formatEnum(phase.kind)})`
                : acc.phaseIndex + 1,
        ],
        ["Broker", acc.brokerId],
        ["Broker login", acc.brokerLogin],
        ["KYC", acc.kycVerified ? "Verified" : "Not verified"],
        ["Start balance", formatAmount(acc.startBalance)],
        ["Equity", formatAmount(acc.equity)],
        ["Balance", formatAmount(acc.balance)],
        ["Daily start equity", formatAmount(acc.dailyStartEquity)],
        ["Trading days", acc.tradingDays.length],
    ];
    const rules: [string, string | number][] = [
        ["Profit target", formatPercent(acc.ruleset.profitTarget)],
        ["Max drawdown", formatPercent(acc.ruleset.maxDrawdown)],
        ["Daily drawdown", formatPercent(acc.ruleset.dailyDrawdown)],
        ["Min trading days", acc.ruleset.minTradingDays],
    ];
    if (acc.ruleset.maxWarnings !== undefined) {
        rules.push(["Max warnings", acc.ruleset.maxWarnings]);
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-end gap-2">
                <Button
                    variant="outline"
                    data-testid="account-resync"
                    disabled={act.isPending}
                    onClick={() => act.mutate("resync")}
                >
                    <RefreshCw />
                    Resync ruleset
                </Button>
                <Button
                    variant="outline"
                    data-testid="account-pass"
                    disabled={!active || act.isPending}
                    onClick={() => act.mutate("pass")}
                >
                    <CircleCheck />
                    Pass
                </Button>
                <Button
                    variant="destructive"
                    data-testid="account-fail"
                    disabled={!active || act.isPending}
                    onClick={() => act.mutate("fail")}
                >
                    <CircleX />
                    Fail
                </Button>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle className="flex flex-wrap items-center gap-2 break-all">
                        {acc.id}
                        <StatusBadge
                            data-testid="account-detail-status"
                            status={acc.status}
                        />
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <DescriptionList items={facts} />
                </CardContent>
            </Card>
            <PageSection title="Ruleset">
                <DescriptionList items={rules} />
            </PageSection>
            <PageSection title="Breaches">
                {breaches.data?.length === 0 ? (
                    <EmptyNote data-testid="account-breaches-empty">
                        No warnings or flags.
                    </EmptyNote>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Severity</TableHead>
                                <TableHead>Rule</TableHead>
                                <TableHead>Phase</TableHead>
                                <TableHead>Subject</TableHead>
                                <TableHead>Time</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {(breaches.data ?? []).map((b) => (
                                <TableRow
                                    key={`${b.phaseIndex}-${b.ruleId}-${b.subjectId}-${b.ts}`}
                                >
                                    <TableCell>
                                        <StatusBadge status={b.severity} />
                                    </TableCell>
                                    <TableCell>
                                        {formatEnum(b.ruleId)}
                                    </TableCell>
                                    <TableCell>{b.phaseIndex + 1}</TableCell>
                                    <TableCell>{b.subjectId}</TableCell>
                                    <TableCell>
                                        {formatDateTime(b.ts)}
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

import { Badge } from "@propfirmcore/ui/components/badge";
import { Button } from "@propfirmcore/ui/components/button";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@propfirmcore/ui/components/card";
import {
    ChartCard,
    type ChartReference,
    LineChart,
    ReferenceLegend,
} from "@propfirmcore/ui/components/chart";
import { useConfirm } from "@propfirmcore/ui/components/confirm-dialog";
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
import { DateTime } from "luxon";
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

function Figure({
    label,
    value,
    detail,
}: {
    label: string;
    value: string;
    detail: string;
}) {
    return (
        <div className="space-y-1">
            <div className="text-sm text-muted-foreground">{label}</div>
            <div className="text-2xl font-semibold tracking-tight">{value}</div>
            <div className="text-sm text-muted-foreground">{detail}</div>
        </div>
    );
}

export const Route = createFileRoute("/_app/trading-accounts/$id")({
    component: TradingAccount,
    staticData: { crumb: "Trading account" },
});

function TradingAccount() {
    const { id } = Route.useParams();
    const setError = useUi((s) => s.setError);
    const confirm = useConfirm();
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
    const r = acc.ruleset;
    const start = acc.startBalance;
    const pnl = acc.equity - start;
    const target = start * (1 + r.profitTarget);
    const floor = start * (1 - r.maxDrawdown);
    const dailyFloor = acc.dailyStartEquity - start * r.dailyDrawdown;
    const warnings = (breaches.data ?? []).filter(
        (b) => b.severity === "warn",
    ).length;
    const currency = (firm.data?.checkout.currency ?? "").toUpperCase();

    const references: ChartReference[] = [
        ...(r.profitTarget > 0
            ? [
                  {
                      key: "target",
                      label: "Profit target",
                      value: target,
                      color: "var(--chart-passed)",
                  },
              ]
            : []),
        {
            key: "daily",
            label: "Daily floor",
            value: dailyFloor,
            color: "var(--chart-warn)",
        },
        {
            key: "floor",
            label: "Max drawdown floor",
            value: floor,
            color: "var(--chart-failed)",
        },
    ];
    const equityPoints = [...(snapshots.data ?? [])]
        .map((s) => ({ t: Date.parse(s.ts), value: s.equity }))
        .filter((p) => Number.isFinite(p.t))
        .sort((x, y) => x.t - y.t);

    const above = (v: number, limit: number) =>
        v >= limit ? `${formatAmount(v - limit)} above` : "Breached";
    const ruleRows: {
        rule: string;
        limit: string;
        threshold: string;
        now: string;
        headroom: string;
    }[] = [
        {
            rule: "Profit target",
            limit: formatPercent(r.profitTarget),
            threshold: r.profitTarget > 0 ? formatAmount(target) : "—",
            now: formatAmount(acc.equity),
            headroom:
                r.profitTarget <= 0
                    ? "No target"
                    : acc.equity >= target
                      ? "Reached"
                      : `${formatAmount(target - acc.equity)} to go`,
        },
        {
            rule: "Max drawdown",
            limit: formatPercent(r.maxDrawdown),
            threshold: formatAmount(floor),
            now: formatAmount(acc.equity),
            headroom: above(acc.equity, floor),
        },
        {
            rule: "Daily drawdown",
            limit: formatPercent(r.dailyDrawdown),
            threshold: formatAmount(dailyFloor),
            now: formatAmount(acc.equity),
            headroom: above(acc.equity, dailyFloor),
        },
        {
            rule: "Min trading days",
            limit: String(r.minTradingDays),
            threshold: "—",
            now: String(acc.tradingDays.length),
            headroom:
                acc.tradingDays.length >= r.minTradingDays
                    ? "Met"
                    : `${r.minTradingDays - acc.tradingDays.length} to go`,
        },
        ...(r.maxWarnings !== undefined
            ? [
                  {
                      rule: "Max warnings",
                      limit: String(r.maxWarnings),
                      threshold: "—",
                      now: String(warnings),
                      headroom:
                          warnings < r.maxWarnings
                              ? `${r.maxWarnings - warnings} left`
                              : "Reached",
                  },
              ]
            : []),
    ];

    return (
        <div className="space-y-6">
            <header className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-semibold">
                            {product?.name ?? acc.productId}
                        </h2>
                        <StatusBadge
                            data-testid="account-detail-status"
                            status={acc.status}
                        />
                        {phase ? (
                            <Badge variant="outline">
                                Phase {acc.phaseIndex + 1} of{" "}
                                {product?.phases.length} ·{" "}
                                {formatEnum(phase.kind)}
                            </Badge>
                        ) : null}
                    </div>
                    <p className="truncate font-mono text-xs text-muted-foreground">
                        {acc.id}
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
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
                        onClick={async () => {
                            const ok = await confirm({
                                title: "Fail this trading account?",
                                description:
                                    "A failed account is closed for good and cannot be reused.",
                                confirmLabel: "Fail account",
                                variant: "destructive",
                            });
                            if (ok) act.mutate("fail");
                        }}
                    >
                        <CircleX />
                        Fail
                    </Button>
                </div>
            </header>

            <Card>
                <CardContent className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                    <Figure
                        label="Equity"
                        value={formatAmount(acc.equity)}
                        detail={`${currency} sim`}
                    />
                    <Figure
                        label="P&L since start"
                        value={`${pnl >= 0 ? "+" : "−"}${formatAmount(Math.abs(pnl))}`}
                        detail={`${pnl >= 0 ? "+" : "−"}${formatPercent(Math.abs(pnl) / start)} of ${formatAmount(start)}`}
                    />
                    <Figure
                        label="Balance"
                        value={formatAmount(acc.balance)}
                        detail={`Day started at ${formatAmount(acc.dailyStartEquity)}`}
                    />
                    <Figure
                        label="Trading days"
                        value={String(acc.tradingDays.length)}
                        detail={`of ${r.minTradingDays} required`}
                    />
                </CardContent>
            </Card>

            <div className="grid gap-4 lg:grid-cols-3">
                <ChartCard
                    className="lg:col-span-2"
                    title="Equity"
                    description="Every snapshot from the broker, with the rule limits for this phase."
                    legend={
                        <ReferenceLegend
                            references={references}
                            formatValue={formatAmount}
                        />
                    }
                    chart={
                        equityPoints.length > 1 ? (
                            <LineChart
                                title="Equity over time"
                                label="Equity"
                                points={equityPoints}
                                references={references}
                                formatValue={formatAmount}
                                formatTime={(t) =>
                                    DateTime.fromMillis(t).toFormat(
                                        "LLL d, HH:mm",
                                    )
                                }
                            />
                        ) : (
                            <EmptyNote>
                                Not enough snapshots to chart yet.
                            </EmptyNote>
                        )
                    }
                    table={{
                        columns: ["Time", "Equity"],
                        rows: [...equityPoints]
                            .reverse()
                            .slice(0, 200)
                            .map((p) => [
                                formatDateTime(new Date(p.t).toISOString()),
                                formatAmount(p.value),
                            ]),
                    }}
                />
                <Card>
                    <CardHeader>
                        <CardTitle>Details</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <DescriptionList
                            items={[
                                ["User", acc.userId],
                                ["Broker", acc.brokerId],
                                ["Broker login", acc.brokerLogin],
                                [
                                    "KYC",
                                    acc.kycVerified
                                        ? "Verified"
                                        : "Not verified",
                                ],
                                ["Start balance", formatAmount(start)],
                                ["Peak equity", formatAmount(acc.peakEquity)],
                            ]}
                        />
                    </CardContent>
                </Card>
            </div>

            <PageSection title="Rules">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Rule</TableHead>
                            <TableHead className="text-right">Limit</TableHead>
                            <TableHead className="text-right">
                                Threshold
                            </TableHead>
                            <TableHead className="text-right">Now</TableHead>
                            <TableHead className="text-right">
                                Headroom
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {ruleRows.map((row) => (
                            <TableRow key={row.rule}>
                                <TableCell>{row.rule}</TableCell>
                                <TableCell className="text-right">
                                    {row.limit}
                                </TableCell>
                                <TableCell className="text-right">
                                    {row.threshold}
                                </TableCell>
                                <TableCell className="text-right">
                                    {row.now}
                                </TableCell>
                                <TableCell
                                    className={
                                        row.headroom === "Breached"
                                            ? "text-right font-medium text-destructive"
                                            : "text-right"
                                    }
                                >
                                    {row.headroom}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
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

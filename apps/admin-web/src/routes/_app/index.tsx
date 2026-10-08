import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@propfirmcore/ui/components/card";
import {
    ChartCard,
    ChartLegend,
    type ChartSeries,
    ColumnChart,
    StackedBars,
} from "@propfirmcore/ui/components/chart";
import { EmptyNote } from "@propfirmcore/ui/components/page-section";
import { formatAmount, formatPercent } from "@propfirmcore/ui/lib/format";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
    ArrowRight,
    Banknote,
    Check,
    CircleDot,
    Clock,
    Flag,
    TriangleAlert,
    X,
} from "lucide-react";
import { DateTime } from "luxon";
import type { ReactNode } from "react";
import { useCan } from "../../access.ts";
import { api, failMsg, keys } from "../../api.ts";
import { fetchFirm } from "../../firm-api.ts";

export const Route = createFileRoute("/_app/")({
    component: Home,
    staticData: { crumb: "Home" },
});

const accountSeries: ChartSeries[] = [
    {
        key: "passed",
        label: "Passed",
        color: "var(--chart-passed)",
        icon: <Check aria-hidden className="size-3" />,
    },
    {
        key: "active",
        label: "Active",
        color: "var(--chart-active)",
        icon: <CircleDot aria-hidden className="size-3" />,
    },
    {
        key: "failed",
        label: "Failed",
        color: "var(--chart-failed)",
        icon: <X aria-hidden className="size-3" />,
    },
];
const breachSeries: ChartSeries[] = [
    {
        key: "warn",
        label: "Warnings",
        color: "var(--chart-warn)",
        icon: <TriangleAlert aria-hidden className="size-3" />,
    },
    {
        key: "flag",
        label: "Flags",
        color: "var(--chart-flag)",
        icon: <Flag aria-hidden className="size-3" />,
    },
];

function useOverview() {
    return useQuery({
        queryKey: ["stats", "overview"],
        queryFn: async () => {
            const { data, error } = await api.GET("/stats/overview");
            if (error) throw error;
            return data;
        },
        refetchInterval: 30_000,
    });
}

function dayLabels(days: string[]): string[] {
    return days.map((d, i) =>
        i === days.length - 1 ? "Today" : DateTime.fromISO(d).toFormat("LLL d"),
    );
}

function AttentionTile({
    to,
    status,
    icon,
    label,
    count,
    amount,
    currency,
    testId,
}: {
    to: "/payments" | "/payouts";
    status: string;
    icon: ReactNode;
    label: string;
    count: number;
    amount: number;
    currency: string;
    testId: string;
}) {
    const idle = count === 0;
    return (
        <Link
            to={to}
            search={{ status } as never}
            data-testid={testId}
            className="group rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
            <Card
                size="sm"
                className="h-full transition-colors group-hover:bg-muted/40"
            >
                <CardContent className="flex items-start gap-3">
                    <span
                        className={
                            idle
                                ? "flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"
                                : "flex size-8 shrink-0 items-center justify-center rounded-lg bg-warning-subtle text-warning"
                        }
                    >
                        {icon}
                    </span>
                    <div className="min-w-0 flex-1">
                        <div className="text-sm text-muted-foreground">
                            {label}
                        </div>
                        <div className="text-2xl font-semibold">{count}</div>
                        <div className="text-sm text-muted-foreground">
                            {idle
                                ? "Nothing waiting"
                                : `${formatAmount(amount)} ${currency}`}
                        </div>
                    </div>
                    <ArrowRight
                        aria-hidden
                        className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                    />
                </CardContent>
            </Card>
        </Link>
    );
}

function Kpi({
    label,
    value,
    detail,
    testId,
}: {
    label: string;
    value: ReactNode;
    detail: ReactNode;
    testId?: string;
}) {
    return (
        <div className="space-y-1" data-testid={testId}>
            <div className="text-sm text-muted-foreground">{label}</div>
            <div className="text-3xl font-semibold tracking-tight">{value}</div>
            <div className="text-sm text-muted-foreground">{detail}</div>
        </div>
    );
}

// The overview needs tradingAccount:list; other Staff get a pointer instead.
function Home() {
    const can = useCan();
    if (can("tradingAccount", "list")) return <AdminHome />;
    return (
        <div data-testid="home-heading">
            <EmptyNote>Pick a section from the menu.</EmptyNote>
        </div>
    );
}

function AdminHome() {
    const can = useCan();
    const overview = useOverview();
    const firm = useQuery({
        queryKey: keys.firm,
        queryFn: fetchFirm,
        enabled: can("firm", "read"),
    });

    if (overview.isError) {
        return (
            <div data-testid="home-heading">
                <EmptyNote>
                    {failMsg(overview.error, "Could not load the overview")}
                </EmptyNote>
            </div>
        );
    }

    const o = overview.data;
    const currency = (firm.data?.checkout.currency ?? "").toUpperCase();
    const names = new Map(
        (firm.data?.products ?? []).map((p) => [p.id, p.name]),
    );
    const decided = o ? o.accounts.passed + o.accounts.failed : 0;
    const labels = o ? dayLabels(o.days) : [];

    return (
        <div
            className="space-y-6 transition-opacity data-[stale=true]:opacity-60"
            data-stale={overview.isFetching && !overview.isPending}
            data-testid="home-heading"
        >
            <section aria-labelledby="attention" className="space-y-3">
                <h2 id="attention" className="text-base font-medium">
                    Needs attention
                </h2>
                <div className="grid gap-3 md:grid-cols-3">
                    <AttentionTile
                        to="/payments"
                        status="pending"
                        icon={<Clock className="size-4" />}
                        label="Payments to complete"
                        count={o?.payments.pending.count ?? 0}
                        amount={o?.payments.pending.amount ?? 0}
                        currency={currency}
                        testId="attention-payments"
                    />
                    <AttentionTile
                        to="/payouts"
                        status="pending"
                        icon={<Clock className="size-4" />}
                        label="Payouts to review"
                        count={o?.payouts.pending.count ?? 0}
                        amount={o?.payouts.pending.amount ?? 0}
                        currency={currency}
                        testId="attention-payouts-pending"
                    />
                    <AttentionTile
                        to="/payouts"
                        status="approved"
                        icon={<Banknote className="size-4" />}
                        label="Approved, not yet paid"
                        count={o?.payouts.approved.count ?? 0}
                        amount={o?.payouts.approved.amount ?? 0}
                        currency={currency}
                        testId="attention-payouts-approved"
                    />
                </div>
            </section>

            <Card>
                <CardContent className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                    <Kpi
                        testId="accounts-count"
                        label="Active trading accounts"
                        value={
                            o ? o.accounts.active.toLocaleString("en-US") : "–"
                        }
                        detail={
                            o
                                ? `${(o.accounts.active + decided).toLocaleString("en-US")} opened in total`
                                : " "
                        }
                    />
                    <Kpi
                        label="Pass rate"
                        value={
                            o && decided
                                ? formatPercent(
                                      Math.round(
                                          (o.accounts.passed / decided) * 1000,
                                      ) / 1000,
                                  )
                                : "–"
                        }
                        detail={
                            o
                                ? `${o.accounts.passed} passed, ${o.accounts.failed} failed`
                                : " "
                        }
                    />
                    <Kpi
                        label="Fees collected"
                        value={o ? formatAmount(o.payments.paid.amount) : "–"}
                        detail={
                            o
                                ? `${currency} from ${o.payments.paid.count.toLocaleString("en-US")} ${o.payments.paid.count === 1 ? "payment" : "payments"}`
                                : " "
                        }
                    />
                    <Kpi
                        label="Paid out"
                        value={o ? formatAmount(o.payouts.paid.amount) : "–"}
                        detail={
                            o
                                ? `${currency} across ${o.payouts.paid.count} ${o.payouts.paid.count === 1 ? "payout" : "payouts"}`
                                : " "
                        }
                    />
                </CardContent>
            </Card>

            {o ? (
                <div className="grid gap-4 lg:grid-cols-2">
                    <ChartCard
                        title="Fills per day"
                        description="Executions reported by brokers, last 14 days."
                        chart={
                            <ColumnChart
                                title="Fills per day"
                                categories={o.days}
                                labels={labels}
                                series={[
                                    {
                                        key: "fills",
                                        label: "Fills",
                                        color: "var(--chart-ink)",
                                    },
                                ]}
                                data={{ fills: o.fills }}
                                emphasizeLast
                            />
                        }
                        table={{
                            columns: ["Day", "Fills"],
                            rows: o.days.map((d, i) => [d, o.fills[i]]),
                        }}
                    />
                    <ChartCard
                        title="Sign-ups per day"
                        description="New user accounts, last 14 days."
                        chart={
                            <ColumnChart
                                title="Sign-ups per day"
                                categories={o.days}
                                labels={labels}
                                series={[
                                    {
                                        key: "signups",
                                        label: "Sign-ups",
                                        color: "var(--chart-ink)",
                                    },
                                ]}
                                data={{ signups: o.signups }}
                                emphasizeLast
                            />
                        }
                        table={{
                            columns: ["Day", "Sign-ups"],
                            rows: o.days.map((d, i) => [d, o.signups[i]]),
                        }}
                    />
                    <ChartCard
                        title="Breaches per day"
                        description="Optional-rule breaches, last 14 days. Warnings count toward max warnings; flags are for admins only."
                        legend={<ChartLegend series={breachSeries} />}
                        chart={
                            o.breaches.warn.every((n) => n === 0) &&
                            o.breaches.flag.every((n) => n === 0) ? (
                                <EmptyNote>
                                    No breaches in the last 14 days.
                                </EmptyNote>
                            ) : (
                                <ColumnChart
                                    title="Breaches per day"
                                    categories={o.days}
                                    labels={labels}
                                    series={breachSeries}
                                    data={o.breaches}
                                />
                            )
                        }
                        table={{
                            columns: ["Day", "Warnings", "Flags"],
                            rows: o.days.map((d, i) => [
                                d,
                                o.breaches.warn[i],
                                o.breaches.flag[i],
                            ]),
                        }}
                    />
                    <ChartCard
                        title="Trading accounts by product"
                        description="Every account opened, by where it stands now."
                        legend={<ChartLegend series={accountSeries} />}
                        chart={
                            o.accounts.byProduct.length ? (
                                <StackedBars
                                    title="Trading accounts by product"
                                    series={accountSeries}
                                    rows={[...o.accounts.byProduct]
                                        .sort(
                                            (a, b) =>
                                                b.active +
                                                b.passed +
                                                b.failed -
                                                (a.active +
                                                    a.passed +
                                                    a.failed),
                                        )
                                        .map((p) => ({
                                            key: p.productId,
                                            label:
                                                names.get(p.productId) ??
                                                p.productId,
                                            values: {
                                                passed: p.passed,
                                                active: p.active,
                                                failed: p.failed,
                                            },
                                        }))}
                                />
                            ) : (
                                <EmptyNote>No trading accounts yet.</EmptyNote>
                            )
                        }
                        table={{
                            columns: ["Product", "Passed", "Active", "Failed"],
                            rows: o.accounts.byProduct.map((p) => [
                                names.get(p.productId) ?? p.productId,
                                p.passed,
                                p.active,
                                p.failed,
                            ]),
                        }}
                    />
                </div>
            ) : (
                <Card>
                    <CardHeader>
                        <CardTitle>Loading activity</CardTitle>
                        <CardDescription>
                            Fetching the latest figures…
                        </CardDescription>
                    </CardHeader>
                </Card>
            )}
        </div>
    );
}

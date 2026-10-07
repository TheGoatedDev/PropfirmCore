import { Badge } from "@propfirmcore/ui/components/badge";
import { Button } from "@propfirmcore/ui/components/button";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@propfirmcore/ui/components/card";
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

function pct(n: number) {
    return `${n * 100}%`;
}

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

    if (account.isError) return <p>Not found</p>;
    if (!account.data) return <p>Loading</p>;

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
                ? `${acc.phaseIndex + 1}. ${phase.name} (${phase.kind})`
                : acc.phaseIndex + 1,
        ],
        ["Broker", acc.brokerId],
        ["Broker login", acc.brokerLogin],
        ["KYC", acc.kycVerified ? "verified" : "not verified"],
        ["Start balance", acc.startBalance],
        ["Equity", acc.equity],
        ["Balance", acc.balance],
        ["Daily start equity", acc.dailyStartEquity],
        ["Trading days", acc.tradingDays.length],
    ];
    const rules: [string, string | number][] = [
        ["Profit target", pct(acc.ruleset.profitTarget)],
        ["Max drawdown", pct(acc.ruleset.maxDrawdown)],
        ["Daily drawdown", pct(acc.ruleset.dailyDrawdown)],
        ["Min trading days", acc.ruleset.minTradingDays],
    ];
    if (acc.ruleset.maxWarnings !== undefined) {
        rules.push(["Max warnings", acc.ruleset.maxWarnings]);
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-end gap-2">
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
                    <CardTitle className="flex items-center gap-2">
                        {acc.id}
                        <Badge data-testid="account-detail-status">
                            {acc.status}
                        </Badge>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-1 text-sm">
                        {facts.map(([k, v]) => (
                            <div key={k} className="contents">
                                <dt className="text-muted-foreground">{k}</dt>
                                <dd>{v}</dd>
                            </div>
                        ))}
                    </dl>
                </CardContent>
            </Card>
            <h3 className="font-medium">Ruleset</h3>
            <Table>
                <TableBody>
                    {rules.map(([k, v]) => (
                        <TableRow key={k}>
                            <TableCell className="text-muted-foreground">
                                {k}
                            </TableCell>
                            <TableCell>{v}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
            <h3 className="font-medium">Breaches</h3>
            {breaches.data?.length === 0 ? (
                <p
                    className="text-sm text-muted-foreground"
                    data-testid="account-breaches-empty"
                >
                    No warnings or flags.
                </p>
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
                                    <Badge
                                        variant={
                                            b.severity === "warn"
                                                ? "destructive"
                                                : "secondary"
                                        }
                                    >
                                        {b.severity}
                                    </Badge>
                                </TableCell>
                                <TableCell>{b.ruleId}</TableCell>
                                <TableCell>{b.phaseIndex + 1}</TableCell>
                                <TableCell>{b.subjectId}</TableCell>
                                <TableCell>{b.ts}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            )}
            <h3 className="font-medium">Fills</h3>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Symbol</TableHead>
                        <TableHead>Side</TableHead>
                        <TableHead>Qty</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead>Time</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {(fills.data ?? []).map((f) => (
                        <TableRow key={f.externalId}>
                            <TableCell>{f.symbol}</TableCell>
                            <TableCell>{f.side}</TableCell>
                            <TableCell>{f.qty}</TableCell>
                            <TableCell>{f.price}</TableCell>
                            <TableCell>{f.ts}</TableCell>
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
                    {(snapshots.data ?? []).map((s) => (
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

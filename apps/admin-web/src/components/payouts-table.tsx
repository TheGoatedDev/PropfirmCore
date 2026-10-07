import {
    type ColumnFiltersState,
    createDataTableColumnHelper,
    DataTable,
    type PaginationState,
} from "@propfirmcore/ui/components/data-table";
import { StatusBadge } from "@propfirmcore/ui/components/status-badge";
import { formatAmount, formatEnum } from "@propfirmcore/ui/lib/format";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Banknote, Check, SquareMousePointer, X } from "lucide-react";
import {
    parseAsIndex,
    parseAsInteger,
    parseAsString,
    parseAsStringLiteral,
    useQueryStates,
} from "nuqs";
import { useMemo } from "react";
import { api, failMsg, keys } from "../api.ts";
import { useUi } from "../stores/ui.ts";

const payoutStatuses = ["pending", "approved", "rejected", "paid"] as const;

type Row = {
    id: string;
    tradingAccountId: string;
    amount: number;
    status: string;
    reason: string | null;
};

const col = createDataTableColumnHelper<Row>();
const payoutSearch = {
    q: parseAsString.withDefault(""),
    status: parseAsStringLiteral(payoutStatuses),
    page: parseAsIndex.withDefault(0),
    pageSize: parseAsInteger.withDefault(10),
};

export function PayoutsTable() {
    const setError = useUi((s) => s.setError);
    const qc = useQueryClient();
    const navigate = useNavigate();
    const [{ q, status, page, pageSize }, setSearch] =
        useQueryStates(payoutSearch);
    const pagination: PaginationState = { pageIndex: page, pageSize };
    const columnFilters: ColumnFiltersState = status
        ? [{ id: "status", value: status }]
        : [];

    const payouts = useQuery({
        queryKey: keys.payouts,
        queryFn: async () => {
            const { data, error } = await api.GET("/payouts");
            if (error) throw error;
            return (data ?? []) as Row[];
        },
    });
    const act = useMutation({
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

    const rows = useMemo(() => {
        const needle = q.trim().toLowerCase();
        return (payouts.data ?? []).filter((p) => {
            if (status && p.status !== status) return false;
            if (
                needle &&
                !p.id.toLowerCase().includes(needle) &&
                !p.tradingAccountId.toLowerCase().includes(needle)
            ) {
                return false;
            }
            return true;
        });
    }, [payouts.data, q, status]);

    const pageRows = rows.slice(
        pagination.pageIndex * pagination.pageSize,
        pagination.pageIndex * pagination.pageSize + pagination.pageSize,
    );

    function run(id: string, action: "approve" | "reject" | "pay") {
        setError(null);
        act.mutate({ id, action });
    }

    return (
        <DataTable
            columns={col.columns([
                col.accessor("id", { header: "ID", enableSorting: false }),
                col.accessor("tradingAccountId", {
                    header: "Trading account",
                    enableSorting: false,
                }),
                col.accessor("amount", {
                    header: () => (
                        <span className="block text-right">Amount</span>
                    ),
                    enableSorting: false,
                    cell: ({ row }) => (
                        <span className="block text-right">
                            {formatAmount(row.original.amount)}
                        </span>
                    ),
                }),
                col.accessor("status", {
                    header: "Status",
                    enableSorting: false,
                    meta: {
                        filter: {
                            variant: "select",
                            options: payoutStatuses.map((s) => ({
                                label: formatEnum(s),
                                value: s,
                            })),
                        },
                    },
                    cell: ({ row }) => (
                        <StatusBadge
                            data-testid={`payout-status-${row.original.id}`}
                            status={row.original.status}
                        />
                    ),
                }),
                col.accessor("reason", {
                    header: "Reason",
                    enableSorting: false,
                    cell: ({ row }) =>
                        row.original.reason
                            ? formatEnum(row.original.reason)
                            : "—",
                }),
            ])}
            data={pageRows}
            total={rows.length}
            pagination={pagination}
            onPaginationChange={(updater) => {
                const next =
                    typeof updater === "function"
                        ? updater(pagination)
                        : updater;
                void setSearch({
                    page: next.pageIndex,
                    pageSize: next.pageSize,
                });
            }}
            filter={q}
            onFilterChange={(v) => {
                void setSearch({ q: v, page: 0 });
            }}
            placeholder="Search by payout or account ID…"
            columnFilters={columnFilters}
            onColumnFiltersChange={(updater) => {
                const next =
                    typeof updater === "function"
                        ? updater(columnFilters)
                        : updater;
                const v = next.find((f) => f.id === "status")?.value;
                void setSearch({
                    status: payoutStatuses.find((s) => s === v) ?? null,
                    page: 0,
                });
            }}
            loading={payouts.isFetching || act.isPending}
            empty="No payouts."
            rowActions={(row) => [
                {
                    label: "Inspect account",
                    icon: <SquareMousePointer />,
                    testId: `payout-inspect-${row.id}`,
                    onSelect: () =>
                        void navigate({
                            to: "/trading-accounts/$id",
                            params: { id: row.tradingAccountId },
                        }),
                },
                {
                    label: "Approve",
                    icon: <Check />,
                    testId: `payout-approve-${row.id}`,
                    disabled: row.status !== "pending",
                    onSelect: () => run(row.id, "approve"),
                },
                {
                    label: "Mark paid",
                    icon: <Banknote />,
                    testId: `payout-pay-${row.id}`,
                    disabled: row.status !== "approved",
                    onSelect: () => run(row.id, "pay"),
                },
                {
                    label: "Reject",
                    icon: <X />,
                    variant: "destructive",
                    testId: `payout-reject-${row.id}`,
                    disabled:
                        row.status !== "pending" && row.status !== "approved",
                    onSelect: () => run(row.id, "reject"),
                },
            ]}
        />
    );
}

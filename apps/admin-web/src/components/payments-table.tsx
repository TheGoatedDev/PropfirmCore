import { useConfirm } from "@propfirmcore/ui/components/confirm-dialog";
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
import { CircleCheck, SquareMousePointer } from "lucide-react";
import {
    parseAsIndex,
    parseAsInteger,
    parseAsString,
    parseAsStringLiteral,
    useQueryStates,
} from "nuqs";
import { useMemo } from "react";
import { api, failMsg, keys } from "../api.ts";
import { fetchFirm } from "../firm-api.ts";
import { useUi } from "../stores/ui.ts";

const paymentStatuses = ["pending", "paid", "failed", "canceled"] as const;

type Row = {
    id: string;
    userId: string;
    productId: string;
    productName?: string;
    amount: number;
    currency: string;
    provider: string;
    status: string;
    brokerId: string;
    tradingAccountId: string | null;
};

const col = createDataTableColumnHelper<Row>();
const paymentSearch = {
    q: parseAsString.withDefault(""),
    status: parseAsStringLiteral(paymentStatuses),
    page: parseAsIndex.withDefault(0),
    pageSize: parseAsInteger.withDefault(10),
};

export function PaymentsTable() {
    const setError = useUi((s) => s.setError);
    const confirm = useConfirm();
    const qc = useQueryClient();
    const navigate = useNavigate();
    const [{ q, status, page, pageSize }, setSearch] =
        useQueryStates(paymentSearch);
    const pagination: PaginationState = { pageIndex: page, pageSize };
    const columnFilters: ColumnFiltersState = status
        ? [{ id: "status", value: status }]
        : [];

    const payments = useQuery({
        queryKey: keys.payments,
        queryFn: async () => {
            const { data, error } = await api.GET("/payments");
            if (error) throw error;
            return (data ?? []) as Row[];
        },
    });
    const firm = useQuery({ queryKey: keys.firm, queryFn: fetchFirm });
    const complete = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await api.POST("/payments/{id}/complete", {
                params: { path: { id } },
            });
            if (error) throw error;
        },
        onSuccess: async () => {
            await Promise.all([
                qc.invalidateQueries({ queryKey: keys.payments }),
                qc.invalidateQueries({ queryKey: keys.accounts }),
            ]);
        },
        onError: (error) => setError(failMsg(error, "Complete failed")),
    });

    const rows = useMemo(() => {
        const names = new Map(
            (firm.data?.products ?? []).map((p) => [p.id, p.name]),
        );
        const needle = q.trim().toLowerCase();
        return (payments.data ?? [])
            .map((p) => ({ ...p, productName: names.get(p.productId) }))
            .filter((p) => {
                if (status && p.status !== status) return false;
                if (
                    needle &&
                    !p.id.toLowerCase().includes(needle) &&
                    !p.userId.toLowerCase().includes(needle)
                ) {
                    return false;
                }
                return true;
            });
    }, [payments.data, firm.data, q, status]);

    const pageRows = rows.slice(
        pagination.pageIndex * pagination.pageSize,
        pagination.pageIndex * pagination.pageSize + pagination.pageSize,
    );

    return (
        <DataTable
            columns={col.columns([
                col.accessor("id", { header: "ID", enableSorting: false }),
                col.accessor("userId", {
                    header: "User",
                    enableSorting: false,
                }),
                col.accessor("productId", {
                    header: "Product",
                    enableSorting: false,
                    cell: ({ row }) =>
                        row.original.productName ?? row.original.productId,
                }),
                col.accessor("amount", {
                    header: () => (
                        <span className="block text-right">Amount</span>
                    ),
                    enableSorting: false,
                    cell: ({ row }) => (
                        <span className="block text-right">
                            {formatAmount(row.original.amount)}{" "}
                            <span className="text-muted-foreground">
                                {row.original.currency.toUpperCase()}
                            </span>
                        </span>
                    ),
                }),
                col.accessor("status", {
                    header: "Status",
                    enableSorting: false,
                    meta: {
                        filter: {
                            variant: "select",
                            options: paymentStatuses.map((s) => ({
                                label: formatEnum(s),
                                value: s,
                            })),
                        },
                    },
                    cell: ({ row }) => (
                        <StatusBadge
                            data-testid={`payment-status-${row.original.id}`}
                            status={row.original.status}
                        />
                    ),
                }),
                col.accessor("provider", {
                    header: "Provider",
                    enableSorting: false,
                    cell: ({ row }) => formatEnum(row.original.provider),
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
            placeholder="Search by payment or user ID…"
            columnFilters={columnFilters}
            onColumnFiltersChange={(updater) => {
                const next =
                    typeof updater === "function"
                        ? updater(columnFilters)
                        : updater;
                const v = next.find((f) => f.id === "status")?.value;
                void setSearch({
                    status: paymentStatuses.find((s) => s === v) ?? null,
                    page: 0,
                });
            }}
            loading={payments.isFetching || complete.isPending}
            empty="No payments."
            rowActions={(row) => [
                {
                    label: "Complete",
                    icon: <CircleCheck />,
                    testId: `payment-complete-${row.id}`,
                    disabled: row.status !== "pending" || complete.isPending,
                    onSelect: async () => {
                        const ok = await confirm({
                            title: `Mark ${formatAmount(row.amount)} ${row.currency.toUpperCase()} as paid?`,
                            description:
                                "Only do this once the cash has arrived. A trading account opens for the trader straight away.",
                            confirmLabel: "Mark paid",
                        });
                        if (!ok) return;
                        setError(null);
                        complete.mutate(row.id);
                    },
                },
                {
                    label: "Inspect account",
                    icon: <SquareMousePointer />,
                    testId: `payment-inspect-${row.id}`,
                    disabled: !row.tradingAccountId,
                    onSelect: () => {
                        if (!row.tradingAccountId) return;
                        void navigate({
                            to: "/trading-accounts/$id",
                            params: { id: row.tradingAccountId },
                        });
                    },
                },
            ]}
        />
    );
}

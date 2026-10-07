import {
    type ColumnFiltersState,
    createDataTableColumnHelper,
    DataTable,
    DataTableColumnHeader,
    type PaginationState,
    type SortingState,
} from "@propfirmcore/ui/components/data-table";
import { StatusBadge } from "@propfirmcore/ui/components/status-badge";
import { formatAmount } from "@propfirmcore/ui/lib/format";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { SquareMousePointer } from "lucide-react";
import {
    parseAsIndex,
    parseAsInteger,
    parseAsString,
    parseAsStringLiteral,
    useQueryStates,
} from "nuqs";
import { useEffect, useState } from "react";
import { api, keys } from "../api.ts";

const sortIds = ["id", "status", "equity", "productId", "userId"] as const;
const accountStatuses = ["active", "passed", "failed"] as const;
const accountSearch = {
    q: parseAsString.withDefault(""),
    page: parseAsIndex.withDefault(0),
    pageSize: parseAsInteger.withDefault(10),
    sort: parseAsStringLiteral(sortIds),
    order: parseAsStringLiteral(["asc", "desc"]),
    status: parseAsStringLiteral(accountStatuses),
};

type Account = {
    id: string;
    productId: string;
    productName?: string;
    status: string;
    equity: number;
};

const col = createDataTableColumnHelper<Account>();
const columns = col.columns([
    col.accessor("id", {
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="ID" />
        ),
    }),
    col.accessor("productId", {
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="Product" />
        ),
        cell: ({ row }) => row.original.productName ?? row.original.productId,
    }),
    col.accessor("status", {
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="Status" />
        ),
        meta: {
            filter: {
                variant: "select",
                options: accountStatuses.map((s) => ({
                    label: s,
                    value: s,
                })),
            },
        },
        cell: ({ row }) => (
            <StatusBadge
                data-testid="account-status"
                status={row.original.status}
            />
        ),
    }),
    col.accessor("equity", {
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="Equity" />
        ),
        cell: ({ row }) => formatAmount(row.original.equity),
    }),
]);

export function TradingAccountsTable() {
    const navigate = useNavigate();
    const [{ q, page, pageSize, sort, order, status }, setSearch] =
        useQueryStates(accountSearch);
    const [filter, setFilter] = useState(q);
    const pagination: PaginationState = { pageIndex: page, pageSize };
    const sorting: SortingState = sort
        ? [{ id: sort, desc: order === "desc" }]
        : [];

    useEffect(() => {
        setFilter(q);
    }, [q]);

    useEffect(() => {
        const t = setTimeout(() => {
            const next = filter.trim();
            if (next === q) return;
            void setSearch({ q: next, page: 0 });
        }, 300);
        return () => clearTimeout(t);
    }, [filter, q, setSearch]);

    const columnFilters: ColumnFiltersState = status
        ? [{ id: "status", value: status }]
        : [];
    const query = {
        page: page + 1,
        pageSize,
        q: q || undefined,
        sort: sort ?? undefined,
        order: sort ? (order ?? "asc") : undefined,
        status: status ?? undefined,
    };

    const accounts = useQuery({
        queryKey: [...keys.accounts, query],
        queryFn: async () => {
            const { data, error } = await api.GET("/trading-accounts", {
                params: { query },
            });
            if (error) throw error;
            return data ?? { items: [], total: 0 };
        },
        placeholderData: keepPreviousData,
    });
    const products = useQuery({
        queryKey: keys.products,
        queryFn: async () => {
            const { data, error } = await api.GET("/products");
            if (error) throw error;
            return (data ?? []) as { id: string; name: string }[];
        },
    });
    const names = new Map((products.data ?? []).map((p) => [p.id, p.name]));
    const rows = (accounts.data?.items ?? []).map((a) => ({
        ...a,
        productName: names.get(a.productId),
    }));

    return (
        <DataTable
            columns={columns}
            data={rows}
            total={accounts.data?.total ?? 0}
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
            sorting={sorting}
            onSortingChange={(updater) => {
                const next =
                    typeof updater === "function" ? updater(sorting) : updater;
                const nextCol = next[0];
                const id = sortIds.find((s) => s === nextCol?.id);
                void setSearch({
                    sort: id ?? null,
                    order: nextCol ? (nextCol.desc ? "desc" : "asc") : null,
                    page: 0,
                });
            }}
            filter={filter}
            onFilterChange={setFilter}
            columnFilters={columnFilters}
            onColumnFiltersChange={(updater) => {
                const next =
                    typeof updater === "function"
                        ? updater(columnFilters)
                        : updater;
                const v = next.find((f) => f.id === "status")?.value;
                const nextStatus = accountStatuses.find((s) => s === v);
                void setSearch({
                    status: nextStatus ?? null,
                    page: 0,
                });
            }}
            loading={accounts.isFetching}
            rowActions={(row) => [
                {
                    label: "Inspect",
                    icon: <SquareMousePointer />,
                    testId: `trading-account-inspect-${row.id}`,
                    onSelect: () =>
                        void navigate({
                            to: "/trading-accounts/$id",
                            params: { id: row.id },
                        }),
                },
            ]}
        />
    );
}

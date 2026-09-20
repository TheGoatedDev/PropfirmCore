import { Badge } from "@propfirmcore/ui/components/badge";
import {
    type ColumnFiltersState,
    createDataTableColumnHelper,
    DataTable,
    DataTableColumnHeader,
    type PaginationState,
    type SortingState,
} from "@propfirmcore/ui/components/data-table";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
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
            <Badge data-testid="account-status">{row.original.status}</Badge>
        ),
    }),
    col.accessor("equity", {
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="Equity" />
        ),
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

    return (
        <DataTable
            columns={columns}
            data={accounts.data?.items ?? []}
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
            onRowClick={(a) =>
                void navigate({
                    to: "/trading-accounts/$id",
                    params: { id: a.id },
                })
            }
        />
    );
}

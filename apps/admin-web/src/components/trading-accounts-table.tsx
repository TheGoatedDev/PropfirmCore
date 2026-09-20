import { Badge } from "@propfirmcore/ui/components/badge";
import {
    type ColumnFiltersState,
    createDataTableColumnHelper,
    DataTable,
    DataTableColumnHeader,
    type PaginationState,
    type SortingState,
} from "@propfirmcore/ui/components/data-table";
import {
    keepPreviousData,
    useMutation,
    useQuery,
    useQueryClient,
} from "@tanstack/react-query";
import { BadgeCheck, CircleCheck, CircleX } from "lucide-react";
import {
    parseAsIndex,
    parseAsInteger,
    parseAsString,
    parseAsStringLiteral,
    useQueryStates,
} from "nuqs";
import { useEffect, useState } from "react";
import { api, failMsg, keys } from "../api.ts";
import { useUi } from "../stores/ui.ts";

type Account = {
    id: string;
    userId: string;
    status: string;
    brokerId: string;
    kycVerified?: boolean;
};

const col = createDataTableColumnHelper<Account>();
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

export function TradingAccountsTable() {
    const setError = useUi((s) => s.setError);
    const qc = useQueryClient();
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
    const accountQuery = {
        page: page + 1,
        pageSize,
        q: q || undefined,
        sort: sort ?? undefined,
        order: sort ? (order ?? "asc") : undefined,
        status: status ?? undefined,
    };

    const accounts = useQuery({
        queryKey: [...keys.accounts, accountQuery],
        queryFn: async () => {
            const { data, error } = await api.GET("/trading-accounts", {
                params: { query: accountQuery },
            });
            if (error) throw error;
            return data ?? { items: [], total: 0 };
        },
        placeholderData: keepPreviousData,
    });

    const setKyc = useMutation({
        mutationFn: async (input: { id: string; verified: boolean }) => {
            const { error } = await api.POST("/users/{id}/kyc", {
                params: { path: { id: input.id } },
                body: { verified: input.verified },
            });
            if (error) throw error;
        },
        onSuccess: async () => {
            await qc.invalidateQueries({ queryKey: keys.accounts });
        },
        onError: (error) => setError(failMsg(error, "KYC failed")),
    });

    const force = useMutation({
        mutationFn: async (input: { id: string; action: "pass" | "fail" }) => {
            const path =
                input.action === "pass"
                    ? "/trading-accounts/{id}/pass"
                    : "/trading-accounts/{id}/fail";
            const { error } = await api.POST(path, {
                params: { path: { id: input.id } },
            });
            if (error) throw error;
        },
        onSuccess: async () => {
            await qc.invalidateQueries({ queryKey: keys.accounts });
        },
        onError: (error) => setError(failMsg(error, "Action failed")),
    });

    return (
        <DataTable
            columns={col.columns([
                col.accessor("id", {
                    header: ({ column }) => (
                        <DataTableColumnHeader column={column} title="ID" />
                    ),
                }),
                col.accessor("userId", {
                    header: ({ column }) => (
                        <DataTableColumnHeader column={column} title="User" />
                    ),
                }),
                col.accessor("brokerId", {
                    header: "Broker",
                    enableSorting: false,
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
                        <Badge data-testid="account-status">
                            {row.original.status}
                        </Badge>
                    ),
                }),
            ])}
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
                const col = next[0];
                const id = sortIds.find((s) => s === col?.id);
                void setSearch({
                    sort: id ?? null,
                    order: col ? (col.desc ? "desc" : "asc") : null,
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
                    label: row.kycVerified ? "Unverify" : "Verify",
                    icon: <BadgeCheck />,
                    testId: `kyc-verify-${row.userId}`,
                    onSelect: () => {
                        setError(null);
                        setKyc.mutate({
                            id: row.userId,
                            verified: !row.kycVerified,
                        });
                    },
                },
                {
                    label: "Pass",
                    icon: <CircleCheck />,
                    onSelect: () => {
                        setError(null);
                        force.mutate({ id: row.id, action: "pass" });
                    },
                },
                {
                    label: "Fail",
                    icon: <CircleX />,
                    variant: "destructive",
                    onSelect: () => {
                        setError(null);
                        force.mutate({ id: row.id, action: "fail" });
                    },
                },
            ]}
        />
    );
}

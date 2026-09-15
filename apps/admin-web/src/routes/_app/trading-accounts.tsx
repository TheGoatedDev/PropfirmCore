import { Badge } from "@propfirmcore/ui/components/badge";
import { Button } from "@propfirmcore/ui/components/button";
import {
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
import { createFileRoute } from "@tanstack/react-router";
import {
    parseAsIndex,
    parseAsString,
    parseAsStringLiteral,
    useQueryStates,
} from "nuqs";
import { useEffect, useState } from "react";
import { api, failMsg, keys } from "../../api.ts";
import { useUi } from "../../stores/ui.ts";

type Account = {
    id: string;
    userId: string;
    status: string;
    brokerId: string;
    kycVerified?: boolean;
};

const col = createDataTableColumnHelper<Account>();
const sortIds = ["id", "status", "equity", "productId", "userId"] as const;
const accountSearch = {
    q: parseAsString.withDefault(""),
    page: parseAsIndex.withDefault(0),
    sort: parseAsStringLiteral(sortIds),
    order: parseAsStringLiteral(["asc", "desc"]),
};

export const Route = createFileRoute("/_app/trading-accounts")({
    component: TradingAccounts,
    staticData: { crumb: "Trading accounts" },
});

function TradingAccounts() {
    const setError = useUi((s) => s.setError);
    const qc = useQueryClient();
    const [{ q, page, sort, order }, setSearch] = useQueryStates(accountSearch);
    const [filter, setFilter] = useState(q);
    const pagination: PaginationState = { pageIndex: page, pageSize: 10 };
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

    const accountQuery = {
        page: page + 1,
        pageSize: 10,
        q: q || undefined,
        sort: sort ?? undefined,
        order: sort ? (order ?? "asc") : undefined,
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
        <section>
            <h2
                className="mb-3 text-lg font-medium"
                data-testid="accounts-heading"
            >
                Trading accounts
            </h2>
            <DataTable
                columns={col.columns([
                    col.accessor("id", {
                        header: ({ column }) => (
                            <DataTableColumnHeader column={column} title="ID" />
                        ),
                    }),
                    col.accessor("userId", {
                        header: ({ column }) => (
                            <DataTableColumnHeader
                                column={column}
                                title="User"
                            />
                        ),
                    }),
                    col.accessor("brokerId", {
                        header: ({ column }) => (
                            <DataTableColumnHeader
                                column={column}
                                title="Broker"
                            />
                        ),
                    }),
                    col.accessor("status", {
                        header: ({ column }) => (
                            <DataTableColumnHeader
                                column={column}
                                title="Status"
                            />
                        ),
                        cell: ({ row }) => (
                            <Badge data-testid="account-status">
                                {row.original.status}
                            </Badge>
                        ),
                    }),
                    col.display({
                        id: "actions",
                        enableSorting: false,
                        cell: ({ row }) => (
                            <div className="space-x-2">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    data-testid={`kyc-verify-${row.original.userId}`}
                                    onClick={() => {
                                        setError(null);
                                        setKyc.mutate({
                                            id: row.original.userId,
                                            verified: !row.original.kycVerified,
                                        });
                                    }}
                                >
                                    {row.original.kycVerified
                                        ? "Unverify"
                                        : "Verify"}
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                        setError(null);
                                        force.mutate({
                                            id: row.original.id,
                                            action: "pass",
                                        });
                                    }}
                                >
                                    Pass
                                </Button>
                                <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => {
                                        setError(null);
                                        force.mutate({
                                            id: row.original.id,
                                            action: "fail",
                                        });
                                    }}
                                >
                                    Fail
                                </Button>
                            </div>
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
                    void setSearch({ page: next.pageIndex });
                }}
                sorting={sorting}
                onSortingChange={(updater) => {
                    const next =
                        typeof updater === "function"
                            ? updater(sorting)
                            : updater;
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
            />
        </section>
    );
}

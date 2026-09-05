import { Badge } from "@propfirmcore/ui/components/badge";
import { Button } from "@propfirmcore/ui/components/button";
import {
    createDataTableColumnHelper,
    DataTable,
    DataTableColumnHeader,
    type PaginationState,
    type SortingState,
} from "@propfirmcore/ui/components/data-table";
import { Input } from "@propfirmcore/ui/components/input";
import { Label } from "@propfirmcore/ui/components/label";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@propfirmcore/ui/components/table";
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
import { type FormEvent, useEffect, useState } from "react";
import { z } from "zod";
import { api, failMsg, keys } from "../../api.ts";
import { useUi } from "../../stores/ui.ts";

type Account = { id: string; userId: string; status: string };

const col = createDataTableColumnHelper<Account>();
const sortIds = ["id", "status", "equity", "productId", "userId"] as const;
const accountSearch = {
    q: parseAsString.withDefault(""),
    page: parseAsIndex.withDefault(0),
    sort: parseAsStringLiteral(sortIds),
    order: parseAsStringLiteral(["asc", "desc"]),
};

const paymentIdSchema = z.object({ paymentId: z.string().min(1) });

export const Route = createFileRoute("/_app/")({
    component: AdminHome,
    staticData: { crumb: "Home" },
});

function AdminHome() {
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
    const payouts = useQuery({
        queryKey: keys.payouts,
        queryFn: async () => {
            const { data, error } = await api.GET("/payouts");
            if (error) throw error;
            return data ?? [];
        },
    });

    async function invalidate() {
        await Promise.all([
            qc.invalidateQueries({ queryKey: keys.accounts }),
            qc.invalidateQueries({ queryKey: keys.payouts }),
        ]);
    }

    const complete = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await api.POST("/payments/{id}/complete", {
                params: { path: { id } },
            });
            if (error) throw error;
        },
        onSuccess: invalidate,
        onError: (error) => setError(failMsg(error, "Complete failed")),
    });

    const payoutAct = useMutation({
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
        onSuccess: invalidate,
        onError: (error) => setError(failMsg(error, "Action failed")),
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
        onSuccess: invalidate,
        onError: (error) => setError(failMsg(error, "Action failed")),
    });

    async function submitComplete(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setError(null);
        const parsed = paymentIdSchema.safeParse({
            paymentId: String(
                new FormData(e.currentTarget).get("paymentId") ?? "",
            ),
        });
        if (!parsed.success) {
            setError(parsed.error.issues[0]?.message ?? "Invalid");
            return;
        }
        complete.mutate(parsed.data.paymentId);
    }

    return (
        <>
            <section>
                <h2 className="mb-3 text-lg font-medium">Complete payment</h2>
                <form
                    className="flex items-end gap-3"
                    onSubmit={(e) => void submitComplete(e)}
                >
                    <div className="space-y-1">
                        <Label htmlFor="paymentId">Payment ID</Label>
                        <Input id="paymentId" name="paymentId" required />
                    </div>
                    <Button type="submit">Complete</Button>
                </form>
            </section>
            <section>
                <h2 className="mb-3 text-lg font-medium">Payouts</h2>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>ID</TableHead>
                            <TableHead>Account</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead />
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {(payouts.data ?? []).map((p) => (
                            <TableRow key={p.id}>
                                <TableCell>{p.id}</TableCell>
                                <TableCell>{p.tradingAccountId}</TableCell>
                                <TableCell>{p.amount}</TableCell>
                                <TableCell>
                                    <Badge>{p.status}</Badge>
                                </TableCell>
                                <TableCell className="space-x-2">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                            setError(null);
                                            payoutAct.mutate({
                                                id: p.id,
                                                action: "approve",
                                            });
                                        }}
                                    >
                                        Approve
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                            setError(null);
                                            payoutAct.mutate({
                                                id: p.id,
                                                action: "reject",
                                            });
                                        }}
                                    >
                                        Reject
                                    </Button>
                                    <Button
                                        size="sm"
                                        onClick={() => {
                                            setError(null);
                                            payoutAct.mutate({
                                                id: p.id,
                                                action: "pay",
                                            });
                                        }}
                                    >
                                        Mark paid
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </section>
            <section>
                <h2 className="mb-3 text-lg font-medium">Trading accounts</h2>
                <DataTable
                    columns={col.columns([
                        col.accessor("id", {
                            header: ({ column }) => (
                                <DataTableColumnHeader
                                    column={column}
                                    title="ID"
                                />
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
                        col.accessor("status", {
                            header: ({ column }) => (
                                <DataTableColumnHeader
                                    column={column}
                                    title="Status"
                                />
                            ),
                            cell: ({ row }) => (
                                <Badge>{row.original.status}</Badge>
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
        </>
    );
}

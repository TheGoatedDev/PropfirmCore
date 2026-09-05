import { Badge } from "@propfirmcore/ui/components/badge";
import { Button } from "@propfirmcore/ui/components/button";
import { Card, CardHeader, CardTitle } from "@propfirmcore/ui/components/card";
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
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
    parseAsIndex,
    parseAsString,
    parseAsStringLiteral,
    useQueryStates,
} from "nuqs";
import { useEffect, useState } from "react";
import { api, failMsg, keys } from "../../api.ts";
import { useUi } from "../../stores/ui.ts";

const sortIds = ["id", "status", "equity", "productId", "userId"] as const;
const accountSearch = {
    q: parseAsString.withDefault(""),
    page: parseAsIndex.withDefault(0),
    sort: parseAsStringLiteral(sortIds),
    order: parseAsStringLiteral(["asc", "desc"]),
};

type Product = { id: string; name: string };
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
        cell: ({ row }) => <Badge>{row.original.status}</Badge>,
    }),
    col.accessor("equity", {
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="Equity" />
        ),
    }),
]);

export const Route = createFileRoute("/_app/")({
    component: Dashboard,
    staticData: { crumb: "Home" },
});

function Dashboard() {
    const setError = useUi((s) => s.setError);
    const qc = useQueryClient();
    const navigate = useNavigate();
    const [paymentId, setPaymentId] = useState<string | null>(null);
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

    const query = {
        page: page + 1,
        pageSize: 10,
        q: q || undefined,
        sort: sort ?? undefined,
        order: sort ? (order ?? "asc") : undefined,
    };

    const products = useQuery({
        queryKey: keys.products,
        queryFn: async () => {
            const { data, error } = await api.GET("/products");
            if (error) throw error;
            return (data ?? []) as Product[];
        },
    });
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

    const buy = useMutation({
        mutationFn: async (id: string) => {
            const { data, error } = await api.POST("/products/{id}/buy", {
                params: { path: { id } },
            });
            if (error) throw error;
            return data;
        },
        onSuccess: async (data) => {
            if (data && "payment" in data && data.payment?.id) {
                setPaymentId(data.payment.id);
            }
            await qc.invalidateQueries({ queryKey: keys.accounts });
        },
        onError: (error) => setError(failMsg(error, "Buy failed")),
    });

    return (
        <>
            <section>
                <h2 className="mb-3 text-lg font-medium">Products</h2>
                {paymentId ? <p>Payment ID: {paymentId}</p> : null}
                <div className="space-y-3">
                    {(products.data ?? []).map((p) => (
                        <Card key={p.id}>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <CardTitle>{p.name}</CardTitle>
                                <Button
                                    onClick={() => {
                                        setError(null);
                                        buy.mutate(p.id);
                                    }}
                                >
                                    Buy
                                </Button>
                            </CardHeader>
                        </Card>
                    ))}
                </div>
            </section>
            <section>
                <h2 className="mb-3 text-lg font-medium">Trading accounts</h2>
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
                    onRowClick={(a) =>
                        void navigate({
                            to: "/trading-accounts/$id",
                            params: { id: a.id },
                        })
                    }
                />
            </section>
        </>
    );
}

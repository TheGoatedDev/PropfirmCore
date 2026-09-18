import { Button } from "@propfirmcore/ui/components/button";
import {
    createDataTableColumnHelper,
    DataTable,
    type PaginationState,
    type SortingState,
} from "@propfirmcore/ui/components/data-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { failMsg, keys } from "../../api.ts";
import { fetchFirm, saveFirmSlice } from "../../firm-api.ts";
import { useUi } from "../../stores/ui.ts";

type Row = { id: string; name: string; phases: number };

const col = createDataTableColumnHelper<Row>();

export const Route = createFileRoute("/_app/products/")({
    component: Products,
});

function Products() {
    const setError = useUi((s) => s.setError);
    const qc = useQueryClient();
    const navigate = useNavigate();
    const firm = useQuery({ queryKey: keys.firm, queryFn: fetchFirm });
    const [filter, setFilter] = useState("");
    const [pagination, setPagination] = useState<PaginationState>({
        pageIndex: 0,
        pageSize: 10,
    });
    const [sorting, setSorting] = useState<SortingState>([]);
    const remove = useMutation({
        mutationFn: (id: string) =>
            saveFirmSlice((current) => ({
                ...current,
                products: current.products.filter((p) => p.id !== id),
            })),
        onSuccess: (data) => {
            setError(null);
            qc.setQueryData(keys.firm, data);
        },
        onError: (err) => setError(failMsg(err, "Delete failed")),
    });

    const rows = useMemo(() => {
        const q = filter.trim().toLowerCase();
        return (firm.data?.products ?? [])
            .map((p) => ({
                id: p.id,
                name: p.name,
                phases: p.phases.length,
            }))
            .filter(
                (p) =>
                    !q ||
                    p.id.toLowerCase().includes(q) ||
                    p.name.toLowerCase().includes(q),
            );
    }, [filter, firm.data]);

    const page = rows.slice(
        pagination.pageIndex * pagination.pageSize,
        pagination.pageIndex * pagination.pageSize + pagination.pageSize,
    );

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h1 className="text-xl font-semibold">Products</h1>
                <Button
                    data-testid="add-product"
                    onClick={() => void navigate({ to: "/products/new" })}
                >
                    Add product
                </Button>
            </div>
            {firm.isError ? (
                <p>{failMsg(firm.error, "Could not load firm")}</p>
            ) : null}
            <DataTable
                columns={col.columns([
                    col.accessor("id", { header: "ID", enableSorting: false }),
                    col.accessor("name", {
                        header: "Name",
                        enableSorting: false,
                    }),
                    col.accessor("phases", {
                        header: "Phases",
                        enableSorting: false,
                    }),
                    col.display({
                        id: "actions",
                        enableSorting: false,
                        cell: ({ row }) => (
                            <Button
                                size="sm"
                                variant="destructive"
                                data-testid={`product-delete-${row.original.id}`}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setError(null);
                                    remove.mutate(row.original.id);
                                }}
                            >
                                Delete
                            </Button>
                        ),
                    }),
                ])}
                data={page}
                total={rows.length}
                pagination={pagination}
                onPaginationChange={setPagination}
                sorting={sorting}
                onSortingChange={setSorting}
                filter={filter}
                onFilterChange={(v) => {
                    setFilter(v);
                    setPagination((p) => ({ ...p, pageIndex: 0 }));
                }}
                onRowClick={(row) =>
                    void navigate({
                        to: "/products/$id",
                        params: { id: row.id },
                    })
                }
            />
        </div>
    );
}

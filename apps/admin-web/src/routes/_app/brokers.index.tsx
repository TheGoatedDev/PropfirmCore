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

type Row = { id: string; name: string; provider: string };

const col = createDataTableColumnHelper<Row>();

export const Route = createFileRoute("/_app/brokers/")({
    component: Brokers,
});

function Brokers() {
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
                brokers: current.brokers.filter((b) => b.id !== id),
            })),
        onSuccess: (data) => {
            setError(null);
            qc.setQueryData(keys.firm, data);
        },
        onError: (err) => setError(failMsg(err, "Delete failed")),
    });

    const rows = useMemo(() => {
        const q = filter.trim().toLowerCase();
        return (firm.data?.brokers ?? [])
            .map((b) => ({
                id: b.id,
                name: b.name,
                provider: b.bridge.provider,
            }))
            .filter(
                (b) =>
                    !q ||
                    b.id.toLowerCase().includes(q) ||
                    b.name.toLowerCase().includes(q),
            );
    }, [filter, firm.data]);

    const page = rows.slice(
        pagination.pageIndex * pagination.pageSize,
        pagination.pageIndex * pagination.pageSize + pagination.pageSize,
    );

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h1 className="text-xl font-semibold">Brokers</h1>
                <Button
                    data-testid="add-broker"
                    onClick={() => void navigate({ to: "/brokers/new" })}
                >
                    Add broker
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
                    col.accessor("provider", {
                        header: "Bridge",
                        enableSorting: false,
                    }),
                    col.display({
                        id: "actions",
                        enableSorting: false,
                        cell: ({ row }) => (
                            <Button
                                size="sm"
                                variant="destructive"
                                data-testid={`broker-delete-${row.original.id}`}
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
                        to: "/brokers/$id",
                        params: { id: row.id },
                    })
                }
            />
        </div>
    );
}

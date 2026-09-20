import {
    type ColumnFiltersState,
    createDataTableColumnHelper,
    DataTable,
    type PaginationState,
} from "@propfirmcore/ui/components/data-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import {
    parseAsIndex,
    parseAsInteger,
    parseAsString,
    useQueryStates,
} from "nuqs";
import { useMemo } from "react";
import { failMsg, keys } from "../api.ts";
import { fetchFirm, saveFirmSlice } from "../firm-api.ts";
import { useUi } from "../stores/ui.ts";

type Row = { id: string; name: string; provider: string };

const col = createDataTableColumnHelper<Row>();
const textFilter = { filter: { variant: "text" as const } };
const brokerSearch = {
    q: parseAsString.withDefault(""),
    id: parseAsString.withDefault(""),
    name: parseAsString.withDefault(""),
    page: parseAsIndex.withDefault(0),
    pageSize: parseAsInteger.withDefault(10),
};

export function BrokersTable() {
    const setError = useUi((s) => s.setError);
    const qc = useQueryClient();
    const navigate = useNavigate();
    const firm = useQuery({ queryKey: keys.firm, queryFn: fetchFirm });
    const [{ q, id, name, page, pageSize }, setSearch] =
        useQueryStates(brokerSearch);
    const pagination: PaginationState = { pageIndex: page, pageSize };
    const columnFilters: ColumnFiltersState = [
        ...(id ? [{ id: "id", value: id }] : []),
        ...(name ? [{ id: "name", value: name }] : []),
    ];
    const remove = useMutation({
        mutationFn: (brokerId: string) =>
            saveFirmSlice((current) => ({
                ...current,
                brokers: current.brokers.filter((b) => b.id !== brokerId),
            })),
        onSuccess: (data) => {
            setError(null);
            qc.setQueryData(keys.firm, data);
        },
        onError: (err) => setError(failMsg(err, "Delete failed")),
    });

    const rows = useMemo(() => {
        const needle = q.trim().toLowerCase();
        const idNeedle = id.trim().toLowerCase();
        const nameNeedle = name.trim().toLowerCase();
        return (firm.data?.brokers ?? [])
            .map((b) => ({
                id: b.id,
                name: b.name,
                provider: b.bridge.provider,
            }))
            .filter((b) => {
                if (
                    needle &&
                    !b.id.toLowerCase().includes(needle) &&
                    !b.name.toLowerCase().includes(needle)
                ) {
                    return false;
                }
                if (idNeedle && !b.id.toLowerCase().includes(idNeedle)) {
                    return false;
                }
                if (nameNeedle && !b.name.toLowerCase().includes(nameNeedle)) {
                    return false;
                }
                return true;
            });
    }, [q, id, name, firm.data]);

    const pageRows = rows.slice(
        pagination.pageIndex * pagination.pageSize,
        pagination.pageIndex * pagination.pageSize + pagination.pageSize,
    );

    return (
        <>
            {firm.isError ? (
                <p>{failMsg(firm.error, "Could not load firm")}</p>
            ) : null}
            <DataTable
                columns={col.columns([
                    col.accessor("id", {
                        header: "ID",
                        enableSorting: false,
                        meta: textFilter,
                    }),
                    col.accessor("name", {
                        header: "Name",
                        enableSorting: false,
                        meta: textFilter,
                    }),
                    col.accessor("provider", {
                        header: "Bridge",
                        enableSorting: false,
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
                columnFilters={columnFilters}
                onColumnFiltersChange={(updater) => {
                    const next =
                        typeof updater === "function"
                            ? updater(columnFilters)
                            : updater;
                    const nextId = next.find((f) => f.id === "id")?.value;
                    const nextName = next.find((f) => f.id === "name")?.value;
                    void setSearch({
                        id: typeof nextId === "string" ? nextId : "",
                        name: typeof nextName === "string" ? nextName : "",
                        page: 0,
                    });
                }}
                loading={firm.isFetching}
                rowActions={(row) => [
                    {
                        label: "Delete",
                        icon: <Trash2 />,
                        variant: "destructive",
                        testId: `broker-delete-${row.id}`,
                        onSelect: () => {
                            setError(null);
                            remove.mutate(row.id);
                        },
                    },
                ]}
                onRowClick={(row) =>
                    void navigate({
                        to: "/brokers/$id",
                        params: { id: row.id },
                    })
                }
            />
        </>
    );
}

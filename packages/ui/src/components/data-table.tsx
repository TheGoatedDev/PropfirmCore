import {
    type Column,
    type ColumnDef,
    createColumnHelper,
    type PaginationState,
    type RowData,
    type SortingState,
    useTable,
} from "@tanstack/react-table";
import { ArrowUpDown } from "lucide-react";
import { Button } from "@/components/button";
import { Input } from "@/components/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/table";
import { type DataTableFeatures, features } from "@/lib/data-table-features";

export type { PaginationState, SortingState };
export { type DataTableFeatures, features };

export function createDataTableColumnHelper<TData extends RowData>() {
    return createColumnHelper<DataTableFeatures, TData>();
}

export function DataTableColumnHeader<TData extends RowData, TValue>({
    column,
    title,
}: {
    column: Column<DataTableFeatures, TData, TValue>;
    title: string;
}) {
    if (!column.getCanSort()) return title;
    return (
        <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
            {title}
            <ArrowUpDown />
        </Button>
    );
}

export function DataTable<TData extends RowData>({
    columns,
    data,
    total,
    pagination,
    onPaginationChange,
    sorting,
    onSortingChange,
    filter,
    onFilterChange,
    onRowClick,
}: {
    columns: ColumnDef<DataTableFeatures, TData>[];
    data: TData[];
    total: number;
    pagination: PaginationState;
    onPaginationChange: (
        updater: PaginationState | ((old: PaginationState) => PaginationState),
    ) => void;
    sorting: SortingState;
    onSortingChange: (
        updater: SortingState | ((old: SortingState) => SortingState),
    ) => void;
    filter: string;
    onFilterChange: (value: string) => void;
    onRowClick?: (row: TData) => void;
}) {
    const table = useTable({
        features,
        columns,
        data,
        manualPagination: true,
        manualSorting: true,
        enableMultiSort: false,
        autoResetPageIndex: false,
        rowCount: total,
        state: { pagination, sorting },
        onPaginationChange,
        onSortingChange,
    });
    const rows = table.getRowModel().rows;

    return (
        <div>
            <div className="flex items-center py-4">
                <Input
                    placeholder="Filter id or status…"
                    value={filter}
                    onChange={(event) => onFilterChange(event.target.value)}
                    className="max-w-sm"
                />
            </div>
            <div className="overflow-hidden rounded-md border">
                <Table>
                    <TableHeader>
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map((header) => (
                                    <TableHead key={header.id}>
                                        {header.isPlaceholder ? null : (
                                            <table.FlexRender header={header} />
                                        )}
                                    </TableHead>
                                ))}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {rows.length ? (
                            rows.map((row) => (
                                <TableRow
                                    key={row.id}
                                    className={
                                        onRowClick
                                            ? "cursor-pointer"
                                            : undefined
                                    }
                                    onClick={
                                        onRowClick
                                            ? () => onRowClick(row.original)
                                            : undefined
                                    }
                                >
                                    {row.getAllCells().map((cell) => (
                                        <TableCell key={cell.id}>
                                            <table.FlexRender cell={cell} />
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell
                                    colSpan={columns.length}
                                    className="h-24 text-center"
                                >
                                    No results.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
            <div className="flex items-center justify-end space-x-2 py-4">
                <span className="text-muted-foreground text-sm">
                    Page {pagination.pageIndex + 1} of{" "}
                    {Math.max(table.getPageCount(), 1)}
                </span>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => table.previousPage()}
                    disabled={!table.getCanPreviousPage()}
                >
                    Previous
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => table.nextPage()}
                    disabled={!table.getCanNextPage()}
                >
                    Next
                </Button>
            </div>
        </div>
    );
}

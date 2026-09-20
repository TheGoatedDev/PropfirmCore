import { ContextMenu } from "@base-ui/react/context-menu";
import { Popover } from "@base-ui/react/popover";
import {
    type Column,
    type ColumnDef,
    type ColumnFiltersState,
    createColumnHelper,
    type PaginationState,
    type RowData,
    type SortingState,
    useTable,
} from "@tanstack/react-table";
import {
    ArrowDown,
    ArrowUp,
    ArrowUpDown,
    Ellipsis,
    Filter,
    Search,
} from "lucide-react";
import type { KeyboardEvent, ReactNode } from "react";
import { Button } from "@/components/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/dropdown-menu";
import { Input } from "@/components/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/table";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/tooltip";
import { type DataTableFeatures, features } from "@/lib/data-table-features";

export type { ColumnFiltersState, PaginationState, SortingState };
export { type DataTableFeatures, features };

export type DataTableFilterMeta =
    | { variant: "text" }
    | { variant: "select"; options: { label: string; value: string }[] };

type ColumnMeta = { filter?: DataTableFilterMeta };

function filterMeta(column: {
    columnDef: { meta?: unknown };
}): DataTableFilterMeta | undefined {
    return (column.columnDef.meta as ColumnMeta | undefined)?.filter;
}

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
    const sorted = column.getIsSorted();
    const Icon =
        sorted === "asc"
            ? ArrowUp
            : sorted === "desc"
              ? ArrowDown
              : ArrowUpDown;
    return (
        <Button
            variant="ghost"
            aria-label={`${title}, ${
                sorted === "asc"
                    ? "sorted ascending"
                    : sorted === "desc"
                      ? "sorted descending"
                      : "sortable"
            }`}
            onClick={() => column.toggleSorting()}
        >
            {title}
            <Icon />
        </Button>
    );
}

function ColumnFilterControl<TData extends RowData>({
    column,
}: {
    column: Column<DataTableFeatures, TData, unknown>;
}) {
    const meta = filterMeta(column);
    if (!meta) return null;
    const value = String(column.getFilterValue() ?? "");
    if (meta.variant === "select") {
        return (
            <select
                aria-label={`Filter ${column.id}`}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm"
                value={value}
                onChange={(event) =>
                    column.setFilterValue(event.target.value || undefined)
                }
                data-testid={`table-filter-${column.id}`}
            >
                <option value="">All</option>
                {meta.options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                        {opt.label}
                    </option>
                ))}
            </select>
        );
    }
    return (
        <Input
            aria-label={`Filter ${column.id}`}
            value={value}
            onChange={(event) =>
                column.setFilterValue(event.target.value || undefined)
            }
            data-testid={`table-filter-${column.id}`}
        />
    );
}

function ColumnFilter<TData extends RowData>({
    column,
}: {
    column: Column<DataTableFeatures, TData, unknown>;
}) {
    if (!filterMeta(column)) return null;
    const active = String(column.getFilterValue() ?? "") !== "";
    return (
        <Popover.Root>
            <Popover.Trigger
                render={
                    <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label={`Filter ${column.id}`}
                        aria-pressed={active}
                        className={active ? undefined : "text-muted-foreground"}
                        data-testid={`table-filter-toggle-${column.id}`}
                    />
                }
            >
                <Filter className={active ? "fill-current" : undefined} />
            </Popover.Trigger>
            <Popover.Portal>
                <Popover.Positioner
                    className="isolate z-50"
                    side="bottom"
                    align="start"
                    sideOffset={4}
                >
                    <Popover.Popup className="w-48 rounded-lg bg-popover p-2 shadow-md ring-1 ring-foreground/10">
                        <ColumnFilterControl column={column} />
                    </Popover.Popup>
                </Popover.Positioner>
            </Popover.Portal>
        </Popover.Root>
    );
}

export type DataTableRowAction = {
    label: string;
    icon?: ReactNode;
    onSelect: () => void;
    variant?: "default" | "destructive";
    disabled?: boolean;
    testId?: string;
};

function RowActionsMenu({ items }: { items: DataTableRowAction[] }) {
    if (!items.length) return null;
    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                render={
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Actions"
                        onClick={(event) => event.stopPropagation()}
                    />
                }
            >
                <Ellipsis />
            </DropdownMenuTrigger>
            <DropdownMenuContent
                align="start"
                onClick={(event) => event.stopPropagation()}
            >
                {items.map((item) => (
                    <DropdownMenuItem
                        key={item.label}
                        variant={item.variant ?? "default"}
                        disabled={item.disabled}
                        data-testid={item.testId}
                        onClick={() => item.onSelect()}
                    >
                        {item.icon}
                        {item.label}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
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
    columnFilters,
    onColumnFiltersChange,
    filter,
    onFilterChange,
    placeholder = "Search…",
    loading = false,
    empty = "No results.",
    onRowClick,
    rowActions,
}: {
    columns: ColumnDef<DataTableFeatures, TData>[];
    data: TData[];
    total: number;
    pagination: PaginationState;
    onPaginationChange: (
        updater: PaginationState | ((old: PaginationState) => PaginationState),
    ) => void;
    sorting?: SortingState;
    onSortingChange?: (
        updater: SortingState | ((old: SortingState) => SortingState),
    ) => void;
    columnFilters?: ColumnFiltersState;
    onColumnFiltersChange?: (
        updater:
            | ColumnFiltersState
            | ((old: ColumnFiltersState) => ColumnFiltersState),
    ) => void;
    filter?: string;
    onFilterChange?: (value: string) => void;
    placeholder?: string;
    loading?: boolean;
    empty?: string;
    onRowClick?: (row: TData) => void;
    rowActions?: (row: TData) => DataTableRowAction[];
}) {
    const tableColumns = rowActions
        ? [
              {
                  id: "_actions",
                  enableSorting: false,
                  header: () => <span className="sr-only">Actions</span>,
                  cell: ({ row }) => (
                      <RowActionsMenu items={rowActions(row.original)} />
                  ),
              } satisfies ColumnDef<DataTableFeatures, TData>,
              ...columns,
          ]
        : columns;
    const table = useTable({
        features,
        columns: tableColumns,
        data,
        manualPagination: true,
        manualSorting: true,
        manualFiltering: true,
        enableSorting: Boolean(onSortingChange),
        enableMultiSort: false,
        autoResetPageIndex: false,
        rowCount: total,
        state: {
            pagination,
            sorting: sorting ?? [],
            columnFilters: columnFilters ?? [],
        },
        onPaginationChange,
        onSortingChange,
        onColumnFiltersChange,
    });
    const rows = table.getRowModel().rows;
    const canPrev = table.getCanPreviousPage();
    const canNext = table.getCanNextPage();
    const pageCount = table.getPageCount();
    const showPageSize = total > 10 || pagination.pageSize !== 10;
    const showPager = showPageSize || canPrev || canNext;

    return (
        <TooltipProvider delay={0}>
            <div aria-busy={loading || undefined}>
                {onFilterChange ? (
                    <div className="flex items-center py-4">
                        <div className="relative w-full max-w-sm">
                            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                placeholder={placeholder}
                                aria-label={placeholder}
                                value={filter ?? ""}
                                onChange={(event) =>
                                    onFilterChange(event.target.value)
                                }
                                className="pl-8"
                                data-testid="table-filter"
                            />
                        </div>
                    </div>
                ) : null}
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            {table.getHeaderGroups().map((headerGroup) => (
                                <TableRow key={headerGroup.id}>
                                    {headerGroup.headers.map((header) => {
                                        const sorted =
                                            header.column.getIsSorted();
                                        return (
                                            <TableHead
                                                key={header.id}
                                                aria-sort={
                                                    header.column.getCanSort()
                                                        ? sorted === "asc"
                                                            ? "ascending"
                                                            : sorted === "desc"
                                                              ? "descending"
                                                              : "none"
                                                        : undefined
                                                }
                                            >
                                                {header.isPlaceholder ? null : (
                                                    <div className="flex items-center gap-1">
                                                        <table.FlexRender
                                                            header={header}
                                                        />
                                                        {onColumnFiltersChange ? (
                                                            <ColumnFilter
                                                                column={
                                                                    header.column
                                                                }
                                                            />
                                                        ) : null}
                                                    </div>
                                                )}
                                            </TableHead>
                                        );
                                    })}
                                </TableRow>
                            ))}
                        </TableHeader>
                        <TableBody>
                            {loading && !rows.length ? (
                                ["s1", "s2", "s3", "s4", "s5"].map((id) => (
                                    <TableRow key={id} aria-hidden>
                                        <TableCell colSpan={columns.length}>
                                            <div className="h-4 animate-pulse rounded bg-muted" />
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : rows.length ? (
                                rows.map((row) => {
                                    const items =
                                        rowActions?.(row.original) ?? [];
                                    const cells = row
                                        .getAllCells()
                                        .map((cell) => (
                                            <TableCell key={cell.id}>
                                                <table.FlexRender cell={cell} />
                                            </TableCell>
                                        ));
                                    const rowProps = {
                                        className: onRowClick
                                            ? "cursor-pointer"
                                            : undefined,
                                        tabIndex: onRowClick ? 0 : undefined,
                                        onClick: onRowClick
                                            ? () => onRowClick(row.original)
                                            : undefined,
                                        onKeyDown: onRowClick
                                            ? (event: KeyboardEvent) => {
                                                  if (
                                                      event.key === "Enter" ||
                                                      event.key === " "
                                                  ) {
                                                      event.preventDefault();
                                                      onRowClick(row.original);
                                                  }
                                              }
                                            : undefined,
                                    };
                                    if (!items.length) {
                                        return (
                                            <TableRow
                                                key={row.id}
                                                {...rowProps}
                                            >
                                                {cells}
                                            </TableRow>
                                        );
                                    }
                                    return (
                                        <ContextMenu.Root key={row.id}>
                                            <ContextMenu.Trigger
                                                render={
                                                    <TableRow {...rowProps} />
                                                }
                                            >
                                                {cells}
                                            </ContextMenu.Trigger>
                                            <ContextMenu.Portal>
                                                <ContextMenu.Positioner
                                                    className="isolate z-50 outline-none"
                                                    sideOffset={4}
                                                >
                                                    <ContextMenu.Popup className="z-50 min-w-32 origin-(--transform-origin) rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10">
                                                        {items.map((item) => (
                                                            <ContextMenu.Item
                                                                key={item.label}
                                                                disabled={
                                                                    item.disabled
                                                                }
                                                                data-testid={
                                                                    item.testId
                                                                }
                                                                className={
                                                                    item.variant ===
                                                                    "destructive"
                                                                        ? "flex cursor-default items-center gap-1.5 rounded-md px-1.5 py-1 text-sm text-destructive outline-hidden select-none focus:bg-destructive/10 [&_svg]:size-4 [&_svg]:shrink-0"
                                                                        : "flex cursor-default items-center gap-1.5 rounded-md px-1.5 py-1 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground [&_svg]:size-4 [&_svg]:shrink-0"
                                                                }
                                                                onClick={() =>
                                                                    item.onSelect()
                                                                }
                                                            >
                                                                {item.icon}
                                                                {item.label}
                                                            </ContextMenu.Item>
                                                        ))}
                                                    </ContextMenu.Popup>
                                                </ContextMenu.Positioner>
                                            </ContextMenu.Portal>
                                        </ContextMenu.Root>
                                    );
                                })
                            ) : (
                                <TableRow>
                                    <TableCell
                                        colSpan={columns.length}
                                        className="h-24 text-center"
                                    >
                                        <span data-testid="table-empty">
                                            {empty}
                                        </span>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
                {showPager ? (
                    <div className="flex items-center justify-end gap-2 py-4">
                        {showPageSize ? (
                            <select
                                aria-label="Rows per page"
                                className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
                                value={pagination.pageSize}
                                onChange={(event) => {
                                    onPaginationChange({
                                        pageIndex: 0,
                                        pageSize: Number(event.target.value),
                                    });
                                }}
                                data-testid="table-page-size"
                            >
                                {[10, 20, 50, 100].map((n) => (
                                    <option key={n} value={n}>
                                        {n}
                                    </option>
                                ))}
                            </select>
                        ) : null}
                        {pageCount > 1 ? (
                            <span
                                className="text-muted-foreground text-sm"
                                data-testid="table-page"
                            >
                                Page {pagination.pageIndex + 1} of {pageCount}
                            </span>
                        ) : null}
                        {canPrev ? (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => table.previousPage()}
                                data-testid="table-prev"
                            >
                                Previous
                            </Button>
                        ) : null}
                        {canNext ? (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => table.nextPage()}
                                data-testid="table-next"
                            >
                                Next
                            </Button>
                        ) : null}
                    </div>
                ) : null}
            </div>
        </TooltipProvider>
    );
}

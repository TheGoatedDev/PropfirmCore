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
import { Ban } from "lucide-react";
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
import { nextUserSort } from "./users-sort.ts";

type User = {
    id: string;
    email: string;
    name: string;
    role: "trader" | "admin" | null;
    banned: boolean;
    createdAt: string;
};

const col = createDataTableColumnHelper<User>();
const sortIds = ["email", "createdAt"] as const;
const userSearch = {
    q: parseAsString.withDefault(""),
    page: parseAsIndex.withDefault(0),
    pageSize: parseAsInteger.withDefault(10),
    sort: parseAsStringLiteral(sortIds).withDefault("createdAt"),
    order: parseAsStringLiteral(["asc", "desc"]).withDefault("desc"),
    role: parseAsStringLiteral(["trader", "admin"]),
    banned: parseAsStringLiteral(["true", "false"]),
};
const selectClass =
    "h-8 rounded-lg border border-input bg-transparent px-2 text-sm";

export function UsersTable({ meId }: { meId: string }) {
    const setError = useUi((s) => s.setError);
    const qc = useQueryClient();
    const [{ q, page, pageSize, sort, order, role, banned }, setSearch] =
        useQueryStates(userSearch);
    const [filter, setFilter] = useState(q);
    const pagination: PaginationState = { pageIndex: page, pageSize };
    const sorting: SortingState = [{ id: sort, desc: order === "desc" }];
    const columnFilters: ColumnFiltersState = [
        ...(role ? [{ id: "role", value: role }] : []),
        ...(banned ? [{ id: "banned", value: banned }] : []),
    ];

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

    const userQuery = {
        page: page + 1,
        pageSize,
        q: q || undefined,
        sort,
        order,
        role: role ?? undefined,
        banned: banned ?? undefined,
    };

    const users = useQuery({
        queryKey: [...keys.users, userQuery],
        queryFn: async () => {
            const { data, error } = await api.GET("/users", {
                params: { query: userQuery },
            });
            if (error) throw error;
            return data ?? { items: [], total: 0 };
        },
        placeholderData: keepPreviousData,
    });

    const ban = useMutation({
        mutationFn: async (input: { id: string; banned: boolean }) => {
            const { error } = await api.POST("/users/{id}/ban", {
                params: { path: { id: input.id } },
                body: { banned: input.banned },
            });
            if (error) throw error;
        },
        onSuccess: async () => {
            await qc.invalidateQueries({ queryKey: keys.users });
        },
        onError: (error) => setError(failMsg(error, "Ban failed")),
    });

    const setRole = useMutation({
        mutationFn: async (input: { id: string; role: "trader" | "admin" }) => {
            const { error } = await api.POST("/users/{id}/role", {
                params: { path: { id: input.id } },
                body: { role: input.role },
            });
            if (error) throw error;
        },
        onSuccess: async () => {
            await qc.invalidateQueries({ queryKey: keys.users });
        },
        onError: (error) => setError(failMsg(error, "Role failed")),
    });

    return (
        <DataTable
            columns={col.columns([
                col.accessor("email", {
                    header: ({ column }) => (
                        <DataTableColumnHeader column={column} title="Email" />
                    ),
                }),
                col.accessor("name", {
                    enableSorting: false,
                    header: "Name",
                }),
                col.accessor("role", {
                    enableSorting: false,
                    header: "Role",
                    meta: {
                        filter: {
                            variant: "select",
                            options: [
                                { label: "trader", value: "trader" },
                                { label: "admin", value: "admin" },
                            ],
                        },
                    },
                    cell: ({ row }) => {
                        const self = row.original.id === meId;
                        const roleValue = row.original.role;
                        if (!roleValue) return "—";
                        return (
                            <select
                                className={selectClass}
                                data-testid={`user-role-${row.original.id}`}
                                value={roleValue}
                                disabled={self}
                                onClick={(ev) => ev.stopPropagation()}
                                onChange={(ev) => {
                                    const next = ev.target.value;
                                    if (next !== "trader" && next !== "admin") {
                                        return;
                                    }
                                    setError(null);
                                    setRole.mutate({
                                        id: row.original.id,
                                        role: next,
                                    });
                                }}
                            >
                                <option value="trader">trader</option>
                                <option value="admin">admin</option>
                            </select>
                        );
                    },
                }),
                col.accessor("banned", {
                    enableSorting: false,
                    header: "Banned",
                    meta: {
                        filter: {
                            variant: "select",
                            options: [
                                { label: "Banned", value: "true" },
                                { label: "Active", value: "false" },
                            ],
                        },
                    },
                    cell: ({ row }) =>
                        row.original.banned ? <Badge>Banned</Badge> : null,
                }),
                col.accessor("createdAt", {
                    header: ({ column }) => (
                        <DataTableColumnHeader
                            column={column}
                            title="Created"
                        />
                    ),
                    cell: ({ row }) => row.original.createdAt.slice(0, 10),
                }),
            ])}
            data={users.data?.items ?? []}
            total={users.data?.total ?? 0}
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
                const { sort: nextSort, order: nextOrder } = nextUserSort(
                    sorting,
                    next,
                );
                void setSearch({
                    sort: nextSort,
                    order: nextOrder,
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
                const roleVal = next.find((f) => f.id === "role")?.value;
                const bannedVal = next.find((f) => f.id === "banned")?.value;
                void setSearch({
                    role:
                        roleVal === "trader" || roleVal === "admin"
                            ? roleVal
                            : null,
                    banned:
                        bannedVal === "true" || bannedVal === "false"
                            ? bannedVal
                            : null,
                    page: 0,
                });
            }}
            loading={users.isFetching}
            rowActions={(row) => [
                {
                    label: row.banned ? "Unban" : "Ban",
                    icon: <Ban />,
                    variant: row.banned ? "default" : "destructive",
                    disabled: row.id === meId,
                    testId: `user-ban-${row.id}`,
                    onSelect: () => {
                        if (!row.banned && !window.confirm("Ban this user?")) {
                            return;
                        }
                        setError(null);
                        ban.mutate({
                            id: row.id,
                            banned: !row.banned,
                        });
                    },
                },
            ]}
        />
    );
}

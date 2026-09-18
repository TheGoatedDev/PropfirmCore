import { Badge } from "@propfirmcore/ui/components/badge";
import { Button } from "@propfirmcore/ui/components/button";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@propfirmcore/ui/components/card";
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
import { Route as AppRoute } from "../_app.tsx";

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
    sort: parseAsStringLiteral(sortIds).withDefault("createdAt"),
    order: parseAsStringLiteral(["asc", "desc"]).withDefault("desc"),
    role: parseAsStringLiteral(["trader", "admin"]),
    banned: parseAsStringLiteral(["true", "false"]),
};
const createSchema = z.object({
    email: z.email(),
    name: z.string().min(1),
    password: z.string().min(8),
    role: z.enum(["trader", "admin"]),
});
const selectClass =
    "h-8 rounded-lg border border-input bg-transparent px-2 text-sm";

export const Route = createFileRoute("/_app/users")({
    component: Users,
    staticData: { crumb: "Users" },
});

function Users() {
    const { me } = AppRoute.useRouteContext();
    const setError = useUi((s) => s.setError);
    const qc = useQueryClient();
    const [{ q, page, sort, order, role, banned }, setSearch] =
        useQueryStates(userSearch);
    const [filter, setFilter] = useState(q);
    const [creating, setCreating] = useState(false);
    const pagination: PaginationState = { pageIndex: page, pageSize: 10 };
    const sorting: SortingState = [{ id: sort, desc: order === "desc" }];

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
        pageSize: 10,
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

    const create = useMutation({
        mutationFn: async (input: z.infer<typeof createSchema>) => {
            const { error } = await api.POST("/users", {
                body: input,
            });
            if (error) throw error;
        },
        onSuccess: async () => {
            setCreating(false);
            await qc.invalidateQueries({ queryKey: keys.users });
        },
        onError: (error) => setError(failMsg(error, "Create failed")),
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

    function submit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setError(null);
        const fd = new FormData(e.currentTarget);
        const parsed = createSchema.safeParse({
            email: String(fd.get("email") ?? ""),
            name: String(fd.get("name") ?? ""),
            password: String(fd.get("password") ?? ""),
            role: String(fd.get("role") ?? ""),
        });
        if (!parsed.success) {
            setError(parsed.error.issues[0]?.message ?? "Invalid");
            return;
        }
        create.mutate(parsed.data);
    }

    return (
        <section className="space-y-3">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-medium" data-testid="users-heading">
                    Users
                </h2>
                <Button
                    data-testid="user-create"
                    onClick={() => setCreating((v) => !v)}
                >
                    Create
                </Button>
            </div>
            {creating ? (
                <Card>
                    <CardHeader>
                        <CardTitle>Create user</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form
                            className="grid gap-3 sm:grid-cols-2"
                            onSubmit={(ev) => void submit(ev)}
                        >
                            <div className="space-y-1">
                                <Label htmlFor="user-email">Email</Label>
                                <Input
                                    id="user-email"
                                    name="email"
                                    type="email"
                                    data-testid="user-create-email"
                                    required
                                />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="user-name">Name</Label>
                                <Input
                                    id="user-name"
                                    name="name"
                                    data-testid="user-create-name"
                                    required
                                />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="user-password">Password</Label>
                                <Input
                                    id="user-password"
                                    name="password"
                                    type="password"
                                    data-testid="user-create-password"
                                    required
                                />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="user-role">Role</Label>
                                <select
                                    id="user-role"
                                    name="role"
                                    className={selectClass}
                                    data-testid="user-create-role"
                                    defaultValue="trader"
                                >
                                    <option value="trader">trader</option>
                                    <option value="admin">admin</option>
                                </select>
                            </div>
                            <div className="sm:col-span-2">
                                <Button
                                    type="submit"
                                    data-testid="user-create-submit"
                                >
                                    Save
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            ) : null}
            <div className="flex flex-wrap gap-2">
                <select
                    className={selectClass}
                    data-testid="user-filter-role"
                    value={role ?? ""}
                    onChange={(ev) => {
                        const v = ev.target.value;
                        void setSearch({
                            role: v === "trader" || v === "admin" ? v : null,
                            page: 0,
                        });
                    }}
                >
                    <option value="">All roles</option>
                    <option value="trader">trader</option>
                    <option value="admin">admin</option>
                </select>
                <select
                    className={selectClass}
                    data-testid="user-filter-banned"
                    value={banned ?? ""}
                    onChange={(ev) => {
                        const v = ev.target.value;
                        void setSearch({
                            banned: v === "true" || v === "false" ? v : null,
                            page: 0,
                        });
                    }}
                >
                    <option value="">All</option>
                    <option value="true">Banned</option>
                    <option value="false">Active</option>
                </select>
            </div>
            <DataTable
                columns={col.columns([
                    col.accessor("email", {
                        header: ({ column }) => (
                            <DataTableColumnHeader
                                column={column}
                                title="Email"
                            />
                        ),
                    }),
                    col.accessor("name", {
                        enableSorting: false,
                        header: "Name",
                    }),
                    col.accessor("role", {
                        enableSorting: false,
                        header: "Role",
                        cell: ({ row }) => {
                            const self = row.original.id === me.id;
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
                                        if (
                                            next !== "trader" &&
                                            next !== "admin"
                                        ) {
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
                    col.display({
                        id: "actions",
                        enableSorting: false,
                        cell: ({ row }) => {
                            const self = row.original.id === me.id;
                            return (
                                <Button
                                    size="sm"
                                    variant={
                                        row.original.banned
                                            ? "outline"
                                            : "destructive"
                                    }
                                    data-testid={`user-ban-${row.original.id}`}
                                    disabled={self}
                                    onClick={() => {
                                        if (
                                            !row.original.banned &&
                                            !window.confirm("Ban this user?")
                                        ) {
                                            return;
                                        }
                                        setError(null);
                                        ban.mutate({
                                            id: row.original.id,
                                            banned: !row.original.banned,
                                        });
                                    }}
                                >
                                    {row.original.banned ? "Unban" : "Ban"}
                                </Button>
                            );
                        },
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
                        sort: id ?? "createdAt",
                        order: col ? (col.desc ? "desc" : "asc") : "desc",
                        page: 0,
                    });
                }}
                filter={filter}
                onFilterChange={setFilter}
            />
        </section>
    );
}

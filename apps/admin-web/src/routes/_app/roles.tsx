import {
    catalog,
    hasPermission,
    type Permissions,
    type Resource,
    resources,
    within,
} from "@propfirmcore/access";
import { Badge } from "@propfirmcore/ui/components/badge";
import { Button } from "@propfirmcore/ui/components/button";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@propfirmcore/ui/components/card";
import { Checkbox } from "@propfirmcore/ui/components/checkbox";
import { useConfirm } from "@propfirmcore/ui/components/confirm-dialog";
import {
    createDataTableColumnHelper,
    DataTable,
    type PaginationState,
} from "@propfirmcore/ui/components/data-table";
import { Input } from "@propfirmcore/ui/components/input";
import { Label } from "@propfirmcore/ui/components/label";
import { formatEnum } from "@propfirmcore/ui/lib/format";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { type FormEvent, useState } from "react";
import { useCan, useMe } from "../../access.ts";
import { api, failMsg, fetchRoles, keys } from "../../api.ts";
import { useUi } from "../../stores/ui.ts";

export const Route = createFileRoute("/_app/roles")({
    component: Roles,
    staticData: { crumb: "Roles" },
});

type Role = Awaited<ReturnType<typeof fetchRoles>>[number];
type Draft = { name: string; permissions: Permissions; editing: boolean };

const col = createDataTableColumnHelper<Role>();

function count(p: Permissions): number {
    return resources.reduce((n, r) => n + (p[r]?.length ?? 0), 0);
}

function toggle(
    p: Permissions,
    resource: Resource,
    action: string,
    on: boolean,
): Permissions {
    const current = (p[resource] ?? []) as readonly string[];
    const next = on
        ? [...current, action]
        : current.filter((a) => a !== action);
    return { ...p, [resource]: next };
}

function Roles() {
    const me = useMe();
    const can = useCan();
    const setError = useUi((s) => s.setError);
    const confirm = useConfirm();
    const qc = useQueryClient();
    const [draft, setDraft] = useState<Draft | null>(null);
    const [pagination, setPagination] = useState<PaginationState>({
        pageIndex: 0,
        pageSize: 10,
    });
    const roles = useQuery({ queryKey: keys.roles, queryFn: fetchRoles });
    const canWrite = can("role", "write");
    const editable = (r: Role) =>
        canWrite &&
        !r.builtin &&
        r.name !== me.role &&
        within(r.permissions, me.permissions);

    const save = useMutation({
        mutationFn: async (d: Draft) => {
            const permissions = d.permissions as Role["permissions"];
            const { error } = d.editing
                ? await api.PUT("/roles/{name}", {
                      params: { path: { name: d.name } },
                      body: { permissions },
                  })
                : await api.POST("/roles", {
                      body: { name: d.name, permissions },
                  });
            if (error) throw error;
        },
        onSuccess: async () => {
            setDraft(null);
            await qc.invalidateQueries({ queryKey: keys.roles });
        },
        onError: (error) => setError(failMsg(error, "Save failed")),
    });

    const remove = useMutation({
        mutationFn: async (name: string) => {
            const { error } = await api.DELETE("/roles/{name}", {
                params: { path: { name } },
            });
            if (error) throw error;
        },
        onSuccess: async () => {
            await qc.invalidateQueries({ queryKey: keys.roles });
        },
        onError: (error) => setError(failMsg(error, "Delete failed")),
    });

    function submit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (!draft) return;
        setError(null);
        save.mutate(draft);
    }

    const rows = roles.data ?? [];
    const pageRows = rows.slice(
        pagination.pageIndex * pagination.pageSize,
        (pagination.pageIndex + 1) * pagination.pageSize,
    );

    return (
        <section className="space-y-3" data-testid="roles-heading">
            {roles.isError ? (
                <p>{failMsg(roles.error, "Could not load roles")}</p>
            ) : null}
            {draft ? (
                <Card>
                    <CardHeader>
                        <CardTitle>
                            {draft.editing
                                ? `Edit ${formatEnum(draft.name)}`
                                : "Add role"}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form className="space-y-4" onSubmit={submit}>
                            {draft.editing ? null : (
                                <div className="max-w-sm space-y-1">
                                    <Label htmlFor="role-name">Name</Label>
                                    <Input
                                        id="role-name"
                                        data-testid="role-name"
                                        value={draft.name}
                                        placeholder="support-lead"
                                        pattern="[a-z][a-z0-9\-]{1,31}"
                                        title="Lowercase letters, digits, and dashes"
                                        required
                                        onChange={(ev) =>
                                            setDraft({
                                                ...draft,
                                                name: ev.target.value,
                                            })
                                        }
                                    />
                                </div>
                            )}
                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                                {resources.map((r) => (
                                    <fieldset key={r} className="space-y-2">
                                        <legend className="text-sm font-medium">
                                            {formatEnum(r)}
                                        </legend>
                                        {catalog[r].map((a) => {
                                            const id = `perm-${r}-${a}`;
                                            const held = hasPermission(
                                                me.permissions,
                                                r,
                                                a,
                                            );
                                            return (
                                                <label
                                                    key={a}
                                                    htmlFor={id}
                                                    className="flex items-center gap-2 text-sm has-disabled:text-muted-foreground"
                                                >
                                                    <Checkbox
                                                        id={id}
                                                        data-testid={id}
                                                        disabled={!held}
                                                        checked={hasPermission(
                                                            draft.permissions,
                                                            r,
                                                            a,
                                                        )}
                                                        onCheckedChange={(v) =>
                                                            setDraft({
                                                                ...draft,
                                                                permissions:
                                                                    toggle(
                                                                        draft.permissions,
                                                                        r,
                                                                        a,
                                                                        v ===
                                                                            true,
                                                                    ),
                                                            })
                                                        }
                                                    />
                                                    {formatEnum(a)}
                                                </label>
                                            );
                                        })}
                                    </fieldset>
                                ))}
                            </div>
                            <p className="text-sm text-muted-foreground">
                                You can only grant Permissions your own Role
                                holds.
                            </p>
                            <div className="flex gap-2">
                                <Button
                                    type="submit"
                                    data-testid="role-save"
                                    disabled={save.isPending}
                                >
                                    Save
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setDraft(null)}
                                >
                                    Cancel
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            ) : null}
            <DataTable
                actions={
                    canWrite && (
                        <Button
                            data-testid="role-create"
                            aria-expanded={draft !== null && !draft.editing}
                            onClick={() =>
                                setDraft(
                                    draft && !draft.editing
                                        ? null
                                        : {
                                              name: "",
                                              permissions: {},
                                              editing: false,
                                          },
                                )
                            }
                        >
                            <Plus />
                            Add role
                        </Button>
                    )
                }
                columns={col.columns([
                    col.accessor("name", {
                        header: "Name",
                        enableSorting: false,
                        cell: ({ row }) => (
                            <span className="flex items-center gap-2">
                                {formatEnum(row.original.name)}
                                {row.original.builtin ? (
                                    <Badge variant="secondary">Builtin</Badge>
                                ) : null}
                            </span>
                        ),
                    }),
                    col.accessor("permissions", {
                        header: "Permissions",
                        enableSorting: false,
                        cell: ({ row }) => count(row.original.permissions),
                    }),
                    col.accessor("userCount", {
                        header: "Users",
                        enableSorting: false,
                    }),
                ])}
                data={pageRows}
                total={rows.length}
                pagination={pagination}
                onPaginationChange={(updater) =>
                    setPagination(
                        typeof updater === "function"
                            ? updater(pagination)
                            : updater,
                    )
                }
                loading={roles.isFetching}
                rowActions={(row) => [
                    {
                        label: "Edit",
                        icon: <Pencil />,
                        testId: `role-edit-${row.name}`,
                        hidden: !editable(row),
                        onSelect: () =>
                            setDraft({
                                name: row.name,
                                permissions: row.permissions,
                                editing: true,
                            }),
                    },
                    {
                        label: "Delete",
                        icon: <Trash2 />,
                        variant: "destructive",
                        testId: `role-delete-${row.name}`,
                        hidden: !editable(row),
                        disabled: row.userCount > 0,
                        onSelect: async () => {
                            const ok = await confirm({
                                title: `Delete ${formatEnum(row.name)}?`,
                                description:
                                    "Nobody holds this Role. It cannot be restored.",
                                confirmLabel: "Delete role",
                                variant: "destructive",
                            });
                            if (!ok) return;
                            setError(null);
                            remove.mutate(row.name);
                        },
                    },
                ]}
            />
        </section>
    );
}

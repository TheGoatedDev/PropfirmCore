import { Button } from "@propfirmcore/ui/components/button";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@propfirmcore/ui/components/card";
import { Input } from "@propfirmcore/ui/components/input";
import { Label } from "@propfirmcore/ui/components/label";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { z } from "zod";
import { api, failMsg, keys } from "../../api.ts";
import { UsersTable } from "../../components/users-table.tsx";
import { useUi } from "../../stores/ui.ts";
import { Route as AppRoute } from "../_app.tsx";

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
    const [creating, setCreating] = useState(false);

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
            <div
                className="flex items-center justify-end"
                data-testid="users-heading"
            >
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
            <UsersTable meId={me.id} />
        </section>
    );
}

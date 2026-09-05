import { Button } from "@propfirmcore/ui/components/button";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@propfirmcore/ui/components/card";
import { Input } from "@propfirmcore/ui/components/input";
import { Label } from "@propfirmcore/ui/components/label";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, Navigate, useNavigate } from "@tanstack/react-router";
import type { FormEvent } from "react";
import { z } from "zod";
import { authPost, failMsg, fetchMe, keys } from "../api.ts";
import { useUi } from "../stores/ui.ts";

const signUpSchema = z.object({
    name: z.string().min(1),
    email: z.email(),
    password: z.string().min(1),
});

export function Signup() {
    const me = useQuery({ queryKey: keys.me, queryFn: fetchMe, retry: false });
    if (me.data) return <Navigate to="/" />;
    return <SignUpForm />;
}

function SignUpForm() {
    const setError = useUi((s) => s.setError);
    const qc = useQueryClient();
    const navigate = useNavigate();

    async function submit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setError(null);
        const fd = new FormData(e.currentTarget);
        const parsed = signUpSchema.safeParse({
            name: String(fd.get("name") ?? ""),
            email: String(fd.get("email") ?? ""),
            password: String(fd.get("password") ?? ""),
        });
        if (!parsed.success) {
            setError(parsed.error.issues[0]?.message ?? "Invalid");
            return;
        }
        const { error } = await authPost("/auth/sign-up/email", parsed.data);
        if (error) {
            setError(failMsg(error, "Sign up failed"));
            return;
        }
        await qc.invalidateQueries({ queryKey: keys.me });
        await navigate({ to: "/" });
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Sign up</CardTitle>
            </CardHeader>
            <CardContent>
                <form className="space-y-3" onSubmit={(e) => void submit(e)}>
                    <div className="space-y-1">
                        <Label htmlFor="name">Name</Label>
                        <Input id="name" name="name" required />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="email">Email</Label>
                        <Input id="email" name="email" type="email" required />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="password">Password</Label>
                        <Input
                            id="password"
                            name="password"
                            type="password"
                            required
                        />
                    </div>
                    <Button type="submit">Sign up</Button>
                </form>
                <p className="mt-3 text-sm">
                    <Link to="/" className="underline">
                        Sign in
                    </Link>
                </p>
            </CardContent>
        </Card>
    );
}

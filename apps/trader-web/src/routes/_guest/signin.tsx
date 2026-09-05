import { Button } from "@propfirmcore/ui/components/button";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@propfirmcore/ui/components/card";
import { Input } from "@propfirmcore/ui/components/input";
import { Label } from "@propfirmcore/ui/components/label";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import type { FormEvent } from "react";
import { z } from "zod";
import { authPost, failMsg, fetchMe, keys } from "../../api.ts";
import { useUi } from "../../stores/ui.ts";

const signInSchema = z.object({
    email: z.email(),
    password: z.string().min(1),
});

export const Route = createFileRoute("/_guest/signin")({ component: SignIn });

function SignIn() {
    const setError = useUi((s) => s.setError);
    const qc = useQueryClient();
    const navigate = useNavigate();

    async function submit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setError(null);
        const fd = new FormData(e.currentTarget);
        const parsed = signInSchema.safeParse({
            email: String(fd.get("email") ?? ""),
            password: String(fd.get("password") ?? ""),
        });
        if (!parsed.success) {
            setError(parsed.error.issues[0]?.message ?? "Invalid");
            return;
        }
        const { error } = await authPost("/auth/sign-in/email", parsed.data);
        if (error) {
            setError(failMsg(error, "Sign in failed"));
            return;
        }
        await qc.query({ queryKey: keys.me, queryFn: fetchMe });
        await navigate({ to: "/" });
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Sign in</CardTitle>
            </CardHeader>
            <CardContent>
                <form className="space-y-3" onSubmit={(e) => void submit(e)}>
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
                    <Button type="submit">Sign in</Button>
                </form>
                <p className="mt-3 text-sm">
                    <Link to="/signup" className="underline">
                        Sign up
                    </Link>
                </p>
            </CardContent>
        </Card>
    );
}

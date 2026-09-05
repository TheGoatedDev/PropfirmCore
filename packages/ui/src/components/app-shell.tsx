import type { ReactNode } from "react";
import { Alert, AlertDescription } from "./alert";
import { Button } from "./button";

export function AppShell({
    title,
    user,
    error,
    onSignOut,
    logo,
    sidebar,
    children,
}: {
    title: string;
    user?: { email: string } | null;
    error?: string | null;
    onSignOut?: () => void;
    logo?: ReactNode;
    sidebar?: ReactNode;
    children: ReactNode;
}) {
    return (
        <div className="flex min-h-svh">
            {logo || sidebar ? (
                <aside className="w-52 shrink-0 border-r p-4">
                    {logo ? <div className="mb-4">{logo}</div> : null}
                    {sidebar}
                </aside>
            ) : null}
            <div className="min-w-0 flex-1">
                <div className="mx-auto max-w-3xl space-y-6 p-6">
                    <header className="flex items-center justify-between">
                        <h1 className="text-xl font-semibold">{title}</h1>
                        {user ? (
                            <div className="flex items-center gap-3">
                                <span className="text-sm text-muted-foreground">
                                    {user.email}
                                </span>
                                {onSignOut ? (
                                    <Button
                                        variant="outline"
                                        onClick={onSignOut}
                                    >
                                        Sign out
                                    </Button>
                                ) : null}
                            </div>
                        ) : null}
                    </header>
                    {error ? (
                        <Alert>
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    ) : null}
                    {children}
                </div>
            </div>
        </div>
    );
}

import type { ReactNode } from "react";
import { Alert, AlertDescription } from "./alert";
import { Button } from "./button";

export function SidebarItem({
    icon,
    children,
}: {
    icon?: ReactNode;
    children: ReactNode;
}) {
    return (
        <span className="flex items-center gap-2">
            {icon ? (
                <span className="flex size-4 shrink-0 items-center justify-center [&_svg]:size-4">
                    {icon}
                </span>
            ) : null}
            {children}
        </span>
    );
}

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
        <div className="flex min-h-svh flex-col">
            <header className="flex h-14 shrink-0 items-center justify-between border-b px-4">
                <div className="flex items-center gap-3">
                    {logo}
                    <h1 className="text-lg font-semibold">{title}</h1>
                </div>
                {user ? (
                    <div className="flex items-center gap-3">
                        <span className="text-sm text-muted-foreground">
                            {user.email}
                        </span>
                        {onSignOut ? (
                            <Button variant="outline" onClick={onSignOut}>
                                Sign out
                            </Button>
                        ) : null}
                    </div>
                ) : null}
            </header>
            <div className="flex min-h-0 flex-1">
                {sidebar ? (
                    <aside className="w-52 shrink-0 border-r p-4">
                        {sidebar}
                    </aside>
                ) : null}
                <div className="min-w-0 flex-1">
                    <div className="mx-auto max-w-3xl space-y-6 p-6">
                        {error ? (
                            <Alert>
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        ) : null}
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
}

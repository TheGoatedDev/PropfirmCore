import type { MouseEvent, ReactNode } from "react";
import { Alert, AlertDescription } from "./alert";
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "./breadcrumb";
import { Button } from "./button";

export type Crumb = { label: string; to: string };

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
    crumbs,
    onCrumb,
    children,
}: {
    title: string;
    user?: { email: string } | null;
    error?: string | null;
    onSignOut?: () => void;
    logo?: ReactNode;
    sidebar?: ReactNode;
    crumbs?: Crumb[];
    onCrumb?: (to: string) => void;
    children: ReactNode;
}) {
    return (
        <div className="flex min-h-svh flex-col">
            <header className="flex h-14 shrink-0 items-center justify-between border-b px-4">
                <div className="flex items-center gap-3">
                    {logo ?? <h1 className="text-lg font-semibold">{title}</h1>}
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
                <div className="min-w-0 flex-1 space-y-6 p-6">
                    {crumbs && crumbs.length > 1 ? (
                        <Breadcrumb>
                            <BreadcrumbList>
                                {crumbs.flatMap((c, i) => {
                                    const last = i === crumbs.length - 1;
                                    const key = `${c.to}-${c.label}`;
                                    const item = last ? (
                                        <BreadcrumbItem key={key}>
                                            <BreadcrumbPage>
                                                {c.label}
                                            </BreadcrumbPage>
                                        </BreadcrumbItem>
                                    ) : (
                                        <BreadcrumbItem key={key}>
                                            <BreadcrumbLink
                                                href={c.to}
                                                onClick={(
                                                    e: MouseEvent<HTMLAnchorElement>,
                                                ) => {
                                                    if (
                                                        !onCrumb ||
                                                        e.button !== 0 ||
                                                        e.metaKey ||
                                                        e.altKey ||
                                                        e.ctrlKey ||
                                                        e.shiftKey
                                                    ) {
                                                        return;
                                                    }
                                                    e.preventDefault();
                                                    onCrumb(c.to);
                                                }}
                                            >
                                                {c.label}
                                            </BreadcrumbLink>
                                        </BreadcrumbItem>
                                    );
                                    return i === 0
                                        ? [item]
                                        : [
                                              <BreadcrumbSeparator
                                                  key={`${key}-sep`}
                                              />,
                                              item,
                                          ];
                                })}
                            </BreadcrumbList>
                        </Breadcrumb>
                    ) : null}
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

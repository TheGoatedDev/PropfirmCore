import { PanelLeft, PanelLeftClose } from "lucide-react";
import {
    createContext,
    type MouseEvent,
    type ReactNode,
    useContext,
    useEffect,
    useRef,
    useState,
} from "react";
import { cn } from "@/lib/utils";
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
import { ModeToggle } from "./mode-toggle";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "./tooltip";

export type Crumb = { label: string; to: string };

const SidebarCollapsedContext = createContext(false);

export function SidebarItem({
    icon,
    children,
}: {
    icon?: ReactNode;
    children: ReactNode;
}) {
    const collapsed = useContext(SidebarCollapsedContext);
    const iconEl = icon ? (
        <span className="flex size-4 shrink-0 items-center justify-center [&_svg]:size-4">
            {icon}
        </span>
    ) : null;

    return (
        <Tooltip disabled={!collapsed}>
            <TooltipTrigger
                render={<span className="flex items-center gap-2" />}
            >
                {iconEl}
                <span className={collapsed ? "sr-only" : undefined}>
                    {children}
                </span>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
                {children}
            </TooltipContent>
        </Tooltip>
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
    const brand = logo ?? <h1 className="text-lg font-semibold">{title}</h1>;
    const showCrumbs = crumbs && crumbs.length > 1;
    const scrollerRef = useRef<HTMLDivElement>(null);
    const sentinelRef = useRef<HTMLDivElement>(null);
    const [island, setIsland] = useState(false);
    const [collapsed, setCollapsed] = useState(false);

    useEffect(() => {
        const scroller = scrollerRef.current;
        const sentinel = sentinelRef.current;
        if (!scroller || !sentinel) return;
        const io = new IntersectionObserver(
            ([entry]) => setIsland(!entry.isIntersecting),
            { root: scroller, threshold: 0 },
        );
        io.observe(sentinel);
        return () => io.disconnect();
    }, []);

    return (
        <div className="flex h-svh">
            {sidebar ? (
                <aside
                    id="app-sidebar"
                    className={cn(
                        "flex shrink-0 flex-col overflow-x-hidden overflow-y-auto border-r transition-[width] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none [&_nav]:min-w-0 [&_nav_a]:flex [&_nav_a]:h-8 [&_nav_a]:min-w-0 [&_nav_a]:items-center [&_nav_a]:overflow-hidden [&_nav_a]:whitespace-nowrap [&_nav_a[aria-current=page]]:bg-muted",
                        collapsed ? "w-16" : "w-52",
                    )}
                >
                    <div
                        className={cn(
                            "flex h-14 shrink-0 items-center overflow-hidden px-4",
                            collapsed && "[&_a>span:last-child]:hidden",
                        )}
                    >
                        {brand}
                    </div>
                    <SidebarCollapsedContext.Provider value={collapsed}>
                        <TooltipProvider delay={0}>
                            <div className="min-w-0 p-4">{sidebar}</div>
                        </TooltipProvider>
                    </SidebarCollapsedContext.Provider>
                </aside>
            ) : null}
            <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
                <div className="h-14 shrink-0" />
                <header
                    className={cn(
                        "absolute z-10 flex h-14 items-center justify-between gap-3 overflow-visible px-4 transition-[top,right,left,border-radius,box-shadow,background-color,border-color,backdrop-filter] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none",
                        island
                            ? "top-3 right-3 left-3 rounded-2xl border bg-background/80 shadow-sm backdrop-blur-md"
                            : "inset-x-0 top-0 border-b bg-background",
                    )}
                >
                    <div className="flex min-w-0 items-center gap-3">
                        {sidebar ? (
                            <Button
                                variant="ghost"
                                size="icon"
                                aria-expanded={!collapsed}
                                aria-controls="app-sidebar"
                                aria-label={
                                    collapsed
                                        ? "Expand sidebar"
                                        : "Collapse sidebar"
                                }
                                data-testid="sidebar-toggle"
                                onClick={() => setCollapsed((c) => !c)}
                            >
                                {collapsed ? <PanelLeft /> : <PanelLeftClose />}
                            </Button>
                        ) : null}
                        {sidebar ? null : brand}
                        {showCrumbs ? (
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
                    </div>
                    {user ? (
                        <div className="flex shrink-0 items-center gap-3">
                            <ModeToggle />
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
                <div
                    ref={scrollerRef}
                    className="min-h-0 flex-1 overflow-y-auto"
                >
                    <div
                        ref={sentinelRef}
                        aria-hidden
                        className="pointer-events-none -mb-2 h-2"
                    />
                    <div className="space-y-6 p-6">
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

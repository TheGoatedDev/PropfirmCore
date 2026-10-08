import type * as React from "react";

import { cn } from "@/lib/utils";

// A titled block inside a page. The page title lives in the breadcrumb, so
// sections start at h2.
function PageSection({
    title,
    action,
    className,
    children,
    ...props
}: {
    title: React.ReactNode;
    action?: React.ReactNode;
} & React.ComponentProps<"section">) {
    return (
        <section className={cn("space-y-3", className)} {...props}>
            <div className="flex min-h-8 items-center justify-between gap-3">
                <h2 className="text-base font-medium">{title}</h2>
                {action}
            </div>
            {children}
        </section>
    );
}

function EmptyNote({ children, ...props }: React.ComponentProps<"p">) {
    return (
        <p className="text-sm text-muted-foreground" {...props}>
            {children}
        </p>
    );
}

export { EmptyNote, PageSection };

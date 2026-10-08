import type * as React from "react";

import { cn } from "@/lib/utils";

type Item = readonly [label: string, value: React.ReactNode];

function isEmpty(v: React.ReactNode) {
    return v === null || v === undefined || v === "";
}

// Label/value facts. Empty values render an em dash so a gap reads as "none",
// not as a layout bug.
function DescriptionList({
    items,
    className,
    ...props
}: { items: readonly Item[] } & React.ComponentProps<"dl">) {
    return (
        <dl
            data-slot="description-list"
            className={cn(
                "grid grid-cols-[max-content_1fr] gap-x-6 gap-y-1.5 text-sm tabular-nums",
                className,
            )}
            {...props}
        >
            {items.map(([label, value]) => (
                <div key={label} className="contents">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="min-w-0 break-words">
                        {isEmpty(value) ? (
                            <span className="text-muted-foreground">—</span>
                        ) : (
                            value
                        )}
                    </dd>
                </div>
            ))}
        </dl>
    );
}

export { DescriptionList };

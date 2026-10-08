import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { Button } from "./button";
import { FormMessage } from "./form";

/**
 * One block of a settings page: a 15rem title column and a fields grid.
 * Sections divide with a hairline; the first has none.
 */
function SettingsSection({
    title,
    description,
    children,
    className,
    fields = "grid content-start gap-4 sm:grid-cols-2",
}: {
    title: string;
    description: ReactNode;
    children: ReactNode;
    className?: string;
    /** Classes for the fields column. Pass a stack for full-width content. */
    fields?: string;
}) {
    return (
        <section
            className={cn(
                "grid gap-x-10 gap-y-4 border-t py-6 first:border-t-0 first:pt-0 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]",
                className,
            )}
        >
            <div>
                <h2 className="text-base font-medium">{title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                    {description}
                </p>
            </div>
            <div className={cn("max-w-2xl", fields)}>{children}</div>
        </section>
    );
}

/**
 * Sticky footer for a settings form. Save stays disabled until something
 * changes; Discard appears only when dirty.
 */
function SaveBar({
    dirty,
    saving,
    onDiscard,
    error,
    saveLabel = "Save changes",
    testId,
}: {
    dirty: boolean;
    saving: boolean;
    onDiscard: () => void;
    error?: string;
    saveLabel?: string;
    testId?: string;
}) {
    return (
        <div className="sticky bottom-0 -mx-6 mt-2 flex items-center justify-end gap-3 border-t bg-background/85 px-6 py-3 backdrop-blur-md">
            <FormMessage className="mr-auto">{error}</FormMessage>
            <span className="text-sm text-muted-foreground" aria-live="polite">
                {dirty ? "Unsaved changes" : "All changes saved"}
            </span>
            {dirty ? (
                <Button
                    type="button"
                    variant="ghost"
                    onClick={onDiscard}
                    disabled={saving}
                >
                    Discard
                </Button>
            ) : null}
            <Button
                type="submit"
                disabled={saving || !dirty}
                data-testid={testId}
            >
                {saving ? "Saving…" : saveLabel}
            </Button>
        </div>
    );
}

export { SaveBar, SettingsSection };

import { Combobox as ComboboxPrimitive } from "@base-ui/react/combobox";
import { Check, ChevronDown } from "lucide-react";
import type * as React from "react";

import { cn } from "@/lib/utils";

export type ComboboxOption = {
    value: string;
    label: string;
    /** Muted text on the right, e.g. a UTC offset. Also searchable. */
    hint?: string;
};

/**
 * Searchable single select over a fixed list. Use instead of `Select` when
 * the list is long (timezones, currencies).
 */
function Combobox({
    id,
    options,
    value,
    onValueChange,
    placeholder,
    empty = "No matches.",
    invalid,
    className,
    ...props
}: {
    id?: string;
    options: ComboboxOption[];
    value: string | null;
    onValueChange: (value: string | null) => void;
    placeholder?: string;
    empty?: string;
    invalid?: boolean;
    className?: string;
} & Pick<React.ComponentProps<"input">, "aria-describedby"> & {
        "data-testid"?: string;
    }) {
    const byValue = new Map(options.map((o) => [o.value, o]));
    const selected = value ? (byValue.get(value) ?? null) : null;
    return (
        <ComboboxPrimitive.Root
            items={options}
            value={selected}
            onValueChange={(next: ComboboxOption | null) =>
                onValueChange(next?.value ?? null)
            }
            itemToStringLabel={(o: ComboboxOption) => o.label}
            filter={(o: ComboboxOption, query: string) => {
                const q = query.trim().toLowerCase();
                if (!q) return true;
                return [o.label, o.hint ?? "", o.value].some((t) =>
                    t.toLowerCase().replaceAll("_", " ").includes(q),
                );
            }}
            isItemEqualToValue={(a: ComboboxOption, b: ComboboxOption) =>
                a.value === b.value
            }
        >
            <ComboboxPrimitive.InputGroup
                className={cn(
                    "relative flex h-8 w-full items-center rounded-lg border border-input bg-transparent transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30",
                    invalid &&
                        "border-destructive ring-3 ring-destructive/20 dark:border-destructive/50",
                    className,
                )}
            >
                <ComboboxPrimitive.Input
                    id={id}
                    placeholder={placeholder}
                    aria-invalid={invalid || undefined}
                    className="h-full w-full min-w-0 rounded-lg bg-transparent pr-8 pl-2.5 text-base outline-none placeholder:text-muted-foreground md:text-sm"
                    {...props}
                />
                <ComboboxPrimitive.Trigger
                    aria-label="Show options"
                    className="absolute right-0 flex h-full w-8 items-center justify-center text-muted-foreground"
                >
                    <ChevronDown className="size-4" />
                </ComboboxPrimitive.Trigger>
            </ComboboxPrimitive.InputGroup>
            <ComboboxPrimitive.Portal>
                <ComboboxPrimitive.Positioner
                    className="z-50 outline-none"
                    sideOffset={4}
                >
                    <ComboboxPrimitive.Popup className="w-(--anchor-width) max-w-(--available-width) origin-(--transform-origin) rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 transition-[opacity,scale] duration-100 data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0 motion-reduce:transition-none">
                        <ComboboxPrimitive.Empty className="px-2.5 py-3 text-sm text-muted-foreground empty:hidden">
                            {empty}
                        </ComboboxPrimitive.Empty>
                        <ComboboxPrimitive.List className="max-h-[min(18rem,var(--available-height))] scroll-py-1 overflow-y-auto overscroll-contain p-1 outline-none data-empty:p-0">
                            {(o: ComboboxOption) => (
                                <ComboboxPrimitive.Item
                                    key={o.value}
                                    value={o}
                                    className="grid cursor-default grid-cols-[1rem_1fr_auto] items-center gap-2 rounded-md px-1.5 py-1.5 text-sm outline-none select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground"
                                >
                                    <ComboboxPrimitive.ItemIndicator className="col-start-1">
                                        <Check className="size-4" />
                                    </ComboboxPrimitive.ItemIndicator>
                                    <span className="col-start-2 truncate">
                                        {o.label}
                                    </span>
                                    {o.hint ? (
                                        <span className="col-start-3 text-xs text-muted-foreground tabular-nums">
                                            {o.hint}
                                        </span>
                                    ) : null}
                                </ComboboxPrimitive.Item>
                            )}
                        </ComboboxPrimitive.List>
                    </ComboboxPrimitive.Popup>
                </ComboboxPrimitive.Positioner>
            </ComboboxPrimitive.Portal>
        </ComboboxPrimitive.Root>
    );
}

export { Combobox };

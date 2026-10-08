import { Radio } from "@base-ui/react/radio";
import { RadioGroup } from "@base-ui/react/radio-group";

import { cn } from "@/lib/utils";

export type Choice = { value: string; label: string; description?: string };

/**
 * Radio cards for a small set of options that each need a sentence of
 * explanation. Use `Select` when the options speak for themselves.
 */
function ChoiceGroup({
    choices,
    value,
    onValueChange,
    className,
    ...props
}: {
    choices: readonly Choice[];
    value: string;
    onValueChange: (value: string) => void;
    className?: string;
    "aria-labelledby"?: string;
    "data-testid"?: string;
}) {
    return (
        <RadioGroup
            value={value}
            onValueChange={(v) => onValueChange(String(v))}
            className={cn("grid gap-2 sm:grid-cols-2", className)}
            {...props}
        >
            {choices.map((c) => (
                <label
                    key={c.value}
                    className="flex cursor-pointer gap-3 rounded-lg border border-input p-3 text-sm transition-colors has-data-checked:border-ring has-data-checked:bg-muted/60 has-focus-visible:ring-3 has-focus-visible:ring-ring/50"
                >
                    <Radio.Root
                        value={c.value}
                        data-testid={`choice-${c.value}`}
                        className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border border-input outline-none data-checked:border-primary data-checked:bg-primary"
                    >
                        <Radio.Indicator className="size-1.5 rounded-full bg-primary-foreground" />
                    </Radio.Root>
                    <span className="space-y-0.5">
                        <span className="block font-medium">{c.label}</span>
                        {c.description ? (
                            <span className="block text-muted-foreground">
                                {c.description}
                            </span>
                        ) : null}
                    </span>
                </label>
            ))}
        </RadioGroup>
    );
}

export { ChoiceGroup };

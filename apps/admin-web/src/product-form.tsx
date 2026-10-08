import { zodResolver } from "@hookform/resolvers/zod";
import {
    type ProductWrite,
    payoutModes,
    phaseKinds,
    productWriteSchema,
} from "@propfirmcore/config";
import { Button } from "@propfirmcore/ui/components/button";
import { Checkbox } from "@propfirmcore/ui/components/checkbox";
import {
    type Choice,
    ChoiceGroup,
} from "@propfirmcore/ui/components/choice-group";
import {
    Form,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@propfirmcore/ui/components/form";
import { Input } from "@propfirmcore/ui/components/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@propfirmcore/ui/components/select";
import { SaveBar, SettingsSection } from "@propfirmcore/ui/components/settings";
import { formatAmount, formatEnum } from "@propfirmcore/ui/lib/format";
import { Plus, Trash2 } from "lucide-react";
import { type Resolver, useFieldArray, useForm } from "react-hook-form";
import type { z } from "zod";
import { defaultPayout, productForSave } from "./product-payout.ts";

function emptyPhase(): ProductWrite["phases"][0] {
    return {
        name: "eval",
        kind: "eval",
        balance: 50_000,
        fee: 0,
        ruleset: {
            profitTarget: 0.06,
            maxDrawdown: 0.05,
            dailyDrawdown: 0.02,
            minTradingDays: 0,
        },
    };
}

export function emptyProduct(): ProductWrite {
    return {
        name: "",
        brokers: [],
        phases: [emptyPhase()],
    };
}

// Validate what will be saved, not the form's scratch payout spec.
type ProductInput = z.input<typeof productWriteSchema>;
const zodProduct = zodResolver(productWriteSchema);
const resolver: Resolver<ProductInput, unknown, ProductWrite> = (
    values,
    context,
    options,
) => zodProduct(productForSave(values), context, options);

const payoutModeChoices: Choice[] = payoutModes.map((m) => ({
    value: m,
    label: formatEnum(m),
    description:
        m === "debitOnApprove"
            ? "Sim is withdrawn when an admin approves. Trading continues while pending."
            : "Fills are refused while a payout is pending, then sim is withdrawn on approve.",
}));

function NumberInput({
    id,
    value,
    onChange,
    onBlur,
    step = 1,
    min = 0,
    suffix,
    invalid,
}: {
    id: string;
    value: number | undefined;
    onChange: (n: number) => void;
    onBlur?: () => void;
    step?: number;
    min?: number;
    suffix?: string;
    invalid?: boolean;
}) {
    return (
        <div className="relative">
            <Input
                id={id}
                type="number"
                inputMode="decimal"
                min={min}
                step={step}
                aria-invalid={invalid || undefined}
                className={suffix ? "pr-8 tabular-nums" : "tabular-nums"}
                value={value === undefined || Number.isNaN(value) ? "" : value}
                onBlur={onBlur}
                onChange={(e) => onChange(e.target.valueAsNumber)}
            />
            {suffix ? (
                <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-sm text-muted-foreground">
                    {suffix}
                </span>
            ) : null}
        </div>
    );
}

/** Rule fractions are stored 0–1 (ADR 0009) and edited as percentages. */
function PercentInput({
    id,
    value,
    onChange,
    onBlur,
    invalid,
}: {
    id: string;
    value: number | undefined;
    onChange: (fraction: number) => void;
    onBlur?: () => void;
    invalid?: boolean;
}) {
    return (
        <NumberInput
            id={id}
            step={0.1}
            suffix="%"
            invalid={invalid}
            onBlur={onBlur}
            value={
                value === undefined
                    ? undefined
                    : Math.round(value * 10_000) / 100
            }
            onChange={(pct) => onChange(pct / 100)}
        />
    );
}

export function ProductForm({
    product,
    brokers,
    onSave,
    saving,
}: {
    product: ProductWrite;
    brokers: { id: string; name: string }[];
    onSave: (next: ProductWrite) => void;
    saving: boolean;
}) {
    const locked = Boolean(product.id);
    const initial = {
        ...product,
        payout: product.payout ?? { ...defaultPayout },
    };
    const form = useForm<ProductInput, unknown, ProductWrite>({
        resolver,
        defaultValues: initial,
        values: initial,
        mode: "onTouched",
    });
    const phases = useFieldArray({ control: form.control, name: "phases" });
    const watched = form.watch("phases");
    const funded = watched.some((p) => p.kind === "funded");

    return (
        <Form {...form}>
            <form
                noValidate
                onSubmit={form.handleSubmit((v) => onSave(productForSave(v)))}
            >
                <SettingsSection
                    title="Identity"
                    description="The name traders see on the product list and their accounts."
                >
                    {locked ? (
                        <FormItem>
                            <FormLabel htmlFor="product-id">
                                Product ID
                            </FormLabel>
                            <Input
                                id="product-id"
                                data-testid="product-id"
                                value={product.id ?? ""}
                                readOnly
                                className="bg-muted/50 text-muted-foreground"
                            />
                            <FormDescription>
                                Generated on create. It cannot change.
                            </FormDescription>
                        </FormItem>
                    ) : null}
                    <FormField
                        control={form.control}
                        name="name"
                        render={({ field, fieldState }) => (
                            <FormItem>
                                <FormLabel htmlFor="product-name">
                                    Name
                                </FormLabel>
                                <Input
                                    id="product-name"
                                    data-testid="product-name"
                                    placeholder="e.g. 50k two-step"
                                    aria-invalid={
                                        fieldState.invalid || undefined
                                    }
                                    {...field}
                                />
                                <FormMessage>
                                    {fieldState.error
                                        ? "Name is required"
                                        : null}
                                </FormMessage>
                            </FormItem>
                        )}
                    />
                </SettingsSection>

                <SettingsSection
                    title="Brokers"
                    description="Where traders can trade this product. They pick one at purchase and keep it."
                >
                    <FormField
                        control={form.control}
                        name="brokers"
                        render={({ field, fieldState }) => (
                            <FormItem className="sm:col-span-2">
                                <div className="grid gap-2 sm:grid-cols-2">
                                    {brokers.map((b) => {
                                        const on = field.value.includes(b.id);
                                        return (
                                            <label
                                                key={b.id}
                                                htmlFor={`pb-${b.id}`}
                                                data-testid={`product-broker-${b.id}`}
                                                className="flex cursor-pointer items-center gap-3 rounded-lg border border-input p-3 text-sm transition-colors has-data-checked:border-brand has-data-checked:bg-brand/8"
                                            >
                                                <Checkbox
                                                    id={`pb-${b.id}`}
                                                    checked={on}
                                                    onCheckedChange={(v) => {
                                                        field.onChange(
                                                            v === true
                                                                ? [
                                                                      ...field.value,
                                                                      b.id,
                                                                  ]
                                                                : field.value.filter(
                                                                      (x) =>
                                                                          x !==
                                                                          b.id,
                                                                  ),
                                                        );
                                                        field.onBlur();
                                                    }}
                                                />
                                                <span className="min-w-0">
                                                    <span className="block font-medium">
                                                        {b.name}
                                                    </span>
                                                    <span className="block text-muted-foreground">
                                                        {b.id}
                                                    </span>
                                                </span>
                                            </label>
                                        );
                                    })}
                                </div>
                                {brokers.length === 0 ? (
                                    <FormDescription>
                                        Add a broker first.
                                    </FormDescription>
                                ) : null}
                                <FormMessage>
                                    {fieldState.error
                                        ? "Pick at least one broker."
                                        : null}
                                </FormMessage>
                            </FormItem>
                        )}
                    />
                </SettingsSection>

                <SettingsSection
                    title="Phases"
                    description="Traders walk these in order. Eval phases must pass their rules to advance; funded phases allow payouts. Rule limits are fractions of the phase's start balance."
                    fields="space-y-4"
                >
                    {phases.fields.map((row, pi) => (
                        <fieldset
                            key={row.id}
                            className="space-y-4 rounded-lg border p-4"
                            data-testid={`product-phase-${pi}`}
                        >
                            <div className="flex items-center justify-between gap-3">
                                <legend className="text-sm font-medium">
                                    Phase {pi + 1}
                                    <span className="text-muted-foreground">
                                        {" "}
                                        ·{" "}
                                        {formatEnum(
                                            watched[pi]?.kind ?? "eval",
                                        )}
                                    </span>
                                </legend>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="text-destructive hover:text-destructive"
                                    disabled={phases.fields.length === 1}
                                    onClick={() => phases.remove(pi)}
                                >
                                    <Trash2 />
                                    Remove
                                </Button>
                            </div>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <FormField
                                    control={form.control}
                                    name={`phases.${pi}.name`}
                                    render={({ field, fieldState }) => (
                                        <FormItem>
                                            <FormLabel
                                                htmlFor={`ph-${pi}-name`}
                                            >
                                                Name
                                            </FormLabel>
                                            <Input
                                                id={`ph-${pi}-name`}
                                                aria-invalid={
                                                    fieldState.invalid ||
                                                    undefined
                                                }
                                                {...field}
                                            />
                                            <FormMessage>
                                                {fieldState.error
                                                    ? "Name is required"
                                                    : null}
                                            </FormMessage>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name={`phases.${pi}.kind`}
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel
                                                htmlFor={`ph-${pi}-kind`}
                                            >
                                                Kind
                                            </FormLabel>
                                            <Select
                                                value={field.value}
                                                onValueChange={field.onChange}
                                            >
                                                <SelectTrigger
                                                    id={`ph-${pi}-kind`}
                                                    className="w-full"
                                                >
                                                    <SelectValue>
                                                        {formatEnum}
                                                    </SelectValue>
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {phaseKinds.map((k) => (
                                                        <SelectItem
                                                            key={k}
                                                            value={k}
                                                        >
                                                            {formatEnum(k)}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name={`phases.${pi}.balance`}
                                    render={({ field, fieldState }) => (
                                        <FormItem>
                                            <FormLabel
                                                htmlFor={`ph-${pi}-balance`}
                                            >
                                                Start balance
                                            </FormLabel>
                                            <NumberInput
                                                id={`ph-${pi}-balance`}
                                                step={1000}
                                                min={1}
                                                invalid={fieldState.invalid}
                                                value={field.value}
                                                onBlur={field.onBlur}
                                                onChange={field.onChange}
                                            />
                                            <FormMessage>
                                                {fieldState.error
                                                    ? "Enter a balance above zero."
                                                    : null}
                                            </FormMessage>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name={`phases.${pi}.fee`}
                                    render={({ field, fieldState }) => (
                                        <FormItem>
                                            <FormLabel htmlFor={`ph-${pi}-fee`}>
                                                Fee
                                            </FormLabel>
                                            <NumberInput
                                                id={`ph-${pi}-fee`}
                                                invalid={fieldState.invalid}
                                                value={field.value}
                                                onBlur={field.onBlur}
                                                onChange={field.onChange}
                                            />
                                            <FormMessage>
                                                {fieldState.error
                                                    ? "Fee cannot be negative."
                                                    : null}
                                            </FormMessage>
                                        </FormItem>
                                    )}
                                />
                            </div>
                            <div className="grid gap-4 border-t pt-4 sm:grid-cols-4">
                                {(
                                    [
                                        ["profitTarget", "Profit target"],
                                        ["maxDrawdown", "Max drawdown"],
                                        ["dailyDrawdown", "Daily drawdown"],
                                    ] as const
                                ).map(([key, label]) => (
                                    <FormField
                                        key={key}
                                        control={form.control}
                                        name={`phases.${pi}.ruleset.${key}`}
                                        render={({ field, fieldState }) => (
                                            <FormItem>
                                                <FormLabel
                                                    htmlFor={`ph-${pi}-${key}`}
                                                >
                                                    {label}
                                                </FormLabel>
                                                <PercentInput
                                                    id={`ph-${pi}-${key}`}
                                                    invalid={fieldState.invalid}
                                                    value={field.value}
                                                    onBlur={field.onBlur}
                                                    onChange={field.onChange}
                                                />
                                                <FormMessage>
                                                    {fieldState.error
                                                        ? "0–100%"
                                                        : null}
                                                </FormMessage>
                                            </FormItem>
                                        )}
                                    />
                                ))}
                                <FormField
                                    control={form.control}
                                    name={`phases.${pi}.ruleset.minTradingDays`}
                                    render={({ field, fieldState }) => (
                                        <FormItem>
                                            <FormLabel htmlFor={`ph-${pi}-mtd`}>
                                                Min trading days
                                            </FormLabel>
                                            <NumberInput
                                                id={`ph-${pi}-mtd`}
                                                invalid={fieldState.invalid}
                                                value={field.value}
                                                onBlur={field.onBlur}
                                                onChange={field.onChange}
                                            />
                                            <FormMessage>
                                                {fieldState.error
                                                    ? "Whole days, 0 or more."
                                                    : null}
                                            </FormMessage>
                                        </FormItem>
                                    )}
                                />
                            </div>
                            <p className="text-sm text-muted-foreground tabular-nums">
                                {phaseSummary(watched[pi])}
                            </p>
                        </fieldset>
                    ))}
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => phases.append(emptyPhase())}
                    >
                        <Plus />
                        Add phase
                    </Button>
                    <FormMessage>
                        {form.formState.errors.phases?.root?.message}
                    </FormMessage>
                </SettingsSection>

                <SettingsSection
                    title="Payouts"
                    description="How much of the sim profit a funded trader keeps, and when payouts move sim."
                >
                    {funded ? (
                        <>
                            <FormField
                                control={form.control}
                                name="payout.split"
                                render={({ field, fieldState }) => (
                                    <FormItem>
                                        <FormLabel htmlFor="payout-split">
                                            Trader share
                                        </FormLabel>
                                        <PercentInput
                                            id="payout-split"
                                            invalid={fieldState.invalid}
                                            value={field.value}
                                            onBlur={field.onBlur}
                                            onChange={field.onChange}
                                        />
                                        <FormMessage>
                                            {fieldState.error ? "0–100%" : null}
                                        </FormMessage>
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="payout.mode"
                                render={({ field }) => (
                                    <FormItem className="sm:col-span-2">
                                        <FormLabel id="payout-mode-label">
                                            When a payout is requested
                                        </FormLabel>
                                        <ChoiceGroup
                                            aria-labelledby="payout-mode-label"
                                            choices={payoutModeChoices}
                                            value={
                                                field.value ?? "debitOnApprove"
                                            }
                                            onValueChange={field.onChange}
                                        />
                                    </FormItem>
                                )}
                            />
                        </>
                    ) : (
                        <p className="text-sm text-muted-foreground sm:col-span-2">
                            No funded phase, so no payouts. Set a phase's kind
                            to Funded to configure them.
                        </p>
                    )}
                </SettingsSection>

                <SaveBar
                    // isDirty also counts keys a field adds as undefined (a phase with no fee).
                    dirty={Object.keys(form.formState.dirtyFields).length > 0}
                    saving={saving}
                    onDiscard={() => form.reset(initial)}
                    error={form.formState.errors.root?.message}
                    saveLabel={locked ? "Save changes" : "Create product"}
                    testId="product-save"
                />
            </form>
        </Form>
    );
}

function phaseSummary(p: ProductInput["phases"][0] | undefined): string {
    if (!p) return "";
    const b = p.balance || 0;
    const r = p.ruleset;
    return `On ${formatAmount(b)}: pass at ${formatAmount(b * (1 + (r.profitTarget || 0)))}, fail below ${formatAmount(b * (1 - (r.maxDrawdown || 0)))}, or after losing ${formatAmount(b * (r.dailyDrawdown || 0))} in one day.`;
}

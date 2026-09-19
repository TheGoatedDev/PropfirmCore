import {
    type ProductWrite,
    payoutModes,
    phaseKinds,
} from "@propfirmcore/config";
import { Button } from "@propfirmcore/ui/components/button";
import { Checkbox } from "@propfirmcore/ui/components/checkbox";
import {
    Form,
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
import { useFieldArray, useForm } from "react-hook-form";

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

function NumInput({
    value,
    onChange,
    id,
    step,
}: {
    value: number;
    onChange: (n: number) => void;
    id?: string;
    step?: string;
}) {
    return (
        <Input
            id={id}
            type="number"
            step={step ?? "1"}
            value={Number.isFinite(value) ? value : 0}
            onChange={(e) => onChange(e.target.valueAsNumber)}
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
    const form = useForm<ProductWrite>({
        defaultValues: {
            ...product,
            payout: product.payout ?? {
                split: 0.8,
                mode: "debitOnApprove",
            },
        },
        values: {
            ...product,
            payout: product.payout ?? {
                split: 0.8,
                mode: "debitOnApprove",
            },
        },
    });
    const phases = useFieldArray({ control: form.control, name: "phases" });

    return (
        <Form {...form}>
            <form
                className="space-y-3"
                onSubmit={form.handleSubmit((v) => onSave(v))}
            >
                <div className="grid gap-3 sm:grid-cols-2">
                    {locked ? (
                        <FormField
                            control={form.control}
                            name="id"
                            render={({ field, fieldState }) => (
                                <FormItem>
                                    <FormLabel htmlFor="product-id">
                                        Id
                                    </FormLabel>
                                    <Input
                                        id="product-id"
                                        data-testid="product-id"
                                        disabled
                                        value={field.value ?? ""}
                                        onChange={field.onChange}
                                        onBlur={field.onBlur}
                                        name={field.name}
                                        ref={field.ref}
                                    />
                                    <FormMessage>
                                        {fieldState.error?.message}
                                    </FormMessage>
                                </FormItem>
                            )}
                        />
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
                                    {...field}
                                />
                                <FormMessage>
                                    {fieldState.error?.message}
                                </FormMessage>
                            </FormItem>
                        )}
                    />
                </div>
                <FormField
                    control={form.control}
                    name="brokers"
                    render={({ field, fieldState }) => (
                        <FormItem>
                            <FormLabel>Brokers</FormLabel>
                            <div className="flex flex-wrap gap-3">
                                {brokers.map((b) => (
                                    <div
                                        key={b.id}
                                        className="flex items-center gap-2 text-sm"
                                    >
                                        <Checkbox
                                            id={`pb-${b.id}`}
                                            checked={field.value.includes(b.id)}
                                            onCheckedChange={(v) => {
                                                const on = v === true;
                                                field.onChange(
                                                    on
                                                        ? [...field.value, b.id]
                                                        : field.value.filter(
                                                              (x) => x !== b.id,
                                                          ),
                                                );
                                            }}
                                        />
                                        <FormLabel
                                            htmlFor={`pb-${b.id}`}
                                            data-testid={`product-broker-${b.id}`}
                                        >
                                            {b.name}
                                        </FormLabel>
                                    </div>
                                ))}
                            </div>
                            <FormMessage>
                                {fieldState.error?.message}
                            </FormMessage>
                        </FormItem>
                    )}
                />
                <div className="grid gap-3 sm:grid-cols-3">
                    <FormField
                        control={form.control}
                        name="payout.split"
                        render={({ field, fieldState }) => (
                            <FormItem>
                                <FormLabel>Payout split</FormLabel>
                                <NumInput
                                    step="0.01"
                                    value={field.value ?? 0.8}
                                    onChange={(n) => field.onChange(n)}
                                />
                                <FormMessage>
                                    {fieldState.error?.message}
                                </FormMessage>
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="payout.mode"
                        render={({ field, fieldState }) => (
                            <FormItem>
                                <FormLabel>Payout mode</FormLabel>
                                <Select
                                    value={field.value ?? "debitOnApprove"}
                                    onValueChange={field.onChange}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {payoutModes.map((m) => (
                                            <SelectItem key={m} value={m}>
                                                {m}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <FormMessage>
                                    {fieldState.error?.message}
                                </FormMessage>
                            </FormItem>
                        )}
                    />
                </div>
                <div className="flex justify-between">
                    <p className="text-sm font-medium">Phases</p>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => phases.append(emptyPhase())}
                    >
                        Add phase
                    </Button>
                </div>
                {phases.fields.map((row, pi) => (
                    <div
                        key={row.id}
                        className="grid gap-3 rounded-md border p-3 sm:grid-cols-2"
                    >
                        <FormField
                            control={form.control}
                            name={`phases.${pi}.name`}
                            render={({ field, fieldState }) => (
                                <FormItem>
                                    <FormLabel>Name</FormLabel>
                                    <Input {...field} />
                                    <FormMessage>
                                        {fieldState.error?.message}
                                    </FormMessage>
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name={`phases.${pi}.kind`}
                            render={({ field, fieldState }) => (
                                <FormItem>
                                    <FormLabel>Kind</FormLabel>
                                    <Select
                                        value={field.value}
                                        onValueChange={field.onChange}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {phaseKinds.map((k) => (
                                                <SelectItem key={k} value={k}>
                                                    {k}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage>
                                        {fieldState.error?.message}
                                    </FormMessage>
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name={`phases.${pi}.balance`}
                            render={({ field, fieldState }) => (
                                <FormItem>
                                    <FormLabel>Balance</FormLabel>
                                    <NumInput
                                        value={field.value}
                                        onChange={field.onChange}
                                    />
                                    <FormMessage>
                                        {fieldState.error?.message}
                                    </FormMessage>
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name={`phases.${pi}.fee`}
                            render={({ field, fieldState }) => (
                                <FormItem>
                                    <FormLabel>Fee</FormLabel>
                                    <NumInput
                                        value={field.value ?? 0}
                                        onChange={field.onChange}
                                    />
                                    <FormMessage>
                                        {fieldState.error?.message}
                                    </FormMessage>
                                </FormItem>
                            )}
                        />
                        {(
                            [
                                ["profitTarget", "Profit target", "0.01"],
                                ["maxDrawdown", "Max drawdown", "0.01"],
                                ["dailyDrawdown", "Daily drawdown", "0.01"],
                                ["minTradingDays", "Min trading days", "1"],
                            ] as const
                        ).map(([key, label, step]) => (
                            <FormField
                                key={key}
                                control={form.control}
                                name={`phases.${pi}.ruleset.${key}`}
                                render={({ field, fieldState }) => (
                                    <FormItem>
                                        <FormLabel>{label}</FormLabel>
                                        <NumInput
                                            value={field.value}
                                            onChange={field.onChange}
                                            step={step}
                                        />
                                        <FormMessage>
                                            {fieldState.error?.message}
                                        </FormMessage>
                                    </FormItem>
                                )}
                            />
                        ))}
                        <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => phases.remove(pi)}
                        >
                            Remove phase
                        </Button>
                    </div>
                ))}
                <FormMessage>{form.formState.errors.root?.message}</FormMessage>
                <Button
                    type="submit"
                    disabled={saving}
                    data-testid="product-save"
                >
                    Save
                </Button>
            </form>
        </Form>
    );
}

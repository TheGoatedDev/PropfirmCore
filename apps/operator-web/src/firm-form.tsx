import {
    type FirmConfig,
    onUncoverablePolicies,
    parseFirmConfig,
    payoutModes,
    phaseKinds,
} from "@propfirmcore/config";
import { Button } from "@propfirmcore/ui/components/button";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@propfirmcore/ui/components/card";
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
import { useFieldArray, useForm, useWatch } from "react-hook-form";

const implementedPayoutModes = payoutModes.filter((m) => m !== "debitOnPaid");

function emptyPhase(): FirmConfig["products"][0]["phases"][0] {
    return {
        name: "eval",
        kind: "eval",
        balance: 50_000,
        fee: 0,
        ruleset: {
            profitTarget: 0,
            maxDrawdown: 0,
            dailyDrawdown: 0,
            minTradingDays: 0,
        },
    };
}

function emptyBroker(): FirmConfig["brokers"][0] {
    return {
        id: "",
        name: "",
        bridge: { provider: "loopback" },
    };
}

function emptyProduct(): FirmConfig["products"][0] {
    return {
        id: "",
        name: "",
        brokers: [],
        phases: [emptyPhase()],
    };
}

function cleanFirm(cfg: FirmConfig): FirmConfig {
    return {
        ...cfg,
        products: cfg.products.map((p) => {
            if (p.phases.some((ph) => ph.kind === "funded")) return p;
            const { payout: _, ...rest } = p;
            return rest;
        }),
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

export function FirmForm({
    firm,
    onSave,
    saving,
}: {
    firm: FirmConfig;
    onSave: (next: FirmConfig) => void;
    saving: boolean;
}) {
    const form = useForm<FirmConfig>({
        defaultValues: firm,
        values: firm,
    });
    const brokers = useFieldArray({ control: form.control, name: "brokers" });
    const products = useFieldArray({ control: form.control, name: "products" });
    const brokerIds =
        useWatch({ control: form.control, name: "brokers" })?.map(
            (b) => b.id,
        ) ?? [];

    return (
        <Form {...form}>
            <form
                className="space-y-6"
                onSubmit={form.handleSubmit((v) => {
                    try {
                        onSave(parseFirmConfig(cleanFirm(v)));
                    } catch (err) {
                        form.setError("root", {
                            message:
                                err instanceof Error
                                    ? err.message
                                    : "Invalid firm",
                        });
                    }
                })}
            >
                <Card>
                    <CardHeader>
                        <CardTitle>Firm</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-3 sm:grid-cols-2">
                        <FormField
                            control={form.control}
                            name="id"
                            render={({ field, fieldState }) => (
                                <FormItem>
                                    <FormLabel htmlFor="firm-id">Id</FormLabel>
                                    <Input id="firm-id" {...field} disabled />
                                    <FormMessage>
                                        {fieldState.error?.message}
                                    </FormMessage>
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field, fieldState }) => (
                                <FormItem>
                                    <FormLabel htmlFor="firm-name">
                                        Name
                                    </FormLabel>
                                    <Input
                                        id="firm-name"
                                        data-testid="firm-name"
                                        {...field}
                                    />
                                    <FormMessage>
                                        {fieldState.error?.message}
                                    </FormMessage>
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="dailyClose.tz"
                            render={({ field, fieldState }) => (
                                <FormItem>
                                    <FormLabel htmlFor="tz">Timezone</FormLabel>
                                    <Input id="tz" {...field} />
                                    <FormMessage>
                                        {fieldState.error?.message}
                                    </FormMessage>
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="dailyClose.time"
                            render={({ field, fieldState }) => (
                                <FormItem>
                                    <FormLabel htmlFor="close-time">
                                        Daily close
                                    </FormLabel>
                                    <Input id="close-time" {...field} />
                                    <FormMessage>
                                        {fieldState.error?.message}
                                    </FormMessage>
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="checkout.provider"
                            render={({ field, fieldState }) => (
                                <FormItem>
                                    <FormLabel htmlFor="checkout-provider">
                                        Checkout provider
                                    </FormLabel>
                                    <Input id="checkout-provider" {...field} />
                                    <FormMessage>
                                        {fieldState.error?.message}
                                    </FormMessage>
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="checkout.currency"
                            render={({ field, fieldState }) => (
                                <FormItem>
                                    <FormLabel htmlFor="currency">
                                        Currency
                                    </FormLabel>
                                    <Input id="currency" {...field} />
                                    <FormMessage>
                                        {fieldState.error?.message}
                                    </FormMessage>
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="payout.onUncoverable"
                            render={({ field, fieldState }) => (
                                <FormItem>
                                    <FormLabel>On uncoverable</FormLabel>
                                    <Select
                                        value={field.value}
                                        onValueChange={field.onChange}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {onUncoverablePolicies.map((p) => (
                                                <SelectItem key={p} value={p}>
                                                    {p}
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
                        <div className="space-y-2 sm:col-span-2">
                            <FormLabel>Modules</FormLabel>
                            {(["affiliates", "kyc", "multiBrand"] as const).map(
                                (key) => (
                                    <FormField
                                        key={key}
                                        control={form.control}
                                        name={`modules.${key}`}
                                        render={({ field }) => (
                                            <div className="flex items-center gap-2 text-sm">
                                                <Checkbox
                                                    id={`mod-${key}`}
                                                    checked={field.value}
                                                    onCheckedChange={(v) =>
                                                        field.onChange(
                                                            v === true,
                                                        )
                                                    }
                                                />
                                                <FormLabel
                                                    htmlFor={`mod-${key}`}
                                                >
                                                    {key}
                                                </FormLabel>
                                            </div>
                                        )}
                                    />
                                ),
                            )}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex-row items-center justify-between">
                        <CardTitle>Brokers</CardTitle>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => brokers.append(emptyBroker())}
                            data-testid="add-broker"
                        >
                            Add broker
                        </Button>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {brokers.fields.map((row, i) => (
                            <div
                                key={row.id}
                                className="grid gap-3 rounded-lg border p-3 sm:grid-cols-2"
                            >
                                <FormField
                                    control={form.control}
                                    name={`brokers.${i}.id`}
                                    render={({ field, fieldState }) => (
                                        <FormItem>
                                            <FormLabel
                                                htmlFor={`broker-id-${i}`}
                                            >
                                                Id
                                            </FormLabel>
                                            <Input
                                                id={`broker-id-${i}`}
                                                data-testid={`broker-id-${i}`}
                                                {...field}
                                            />
                                            <FormMessage>
                                                {fieldState.error?.message}
                                            </FormMessage>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name={`brokers.${i}.name`}
                                    render={({ field, fieldState }) => (
                                        <FormItem>
                                            <FormLabel
                                                htmlFor={`broker-name-${i}`}
                                            >
                                                Name
                                            </FormLabel>
                                            <Input
                                                id={`broker-name-${i}`}
                                                data-testid={`broker-name-${i}`}
                                                {...field}
                                            />
                                            <FormMessage>
                                                {fieldState.error?.message}
                                            </FormMessage>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name={`brokers.${i}.bridge.provider`}
                                    render={({ field, fieldState }) => (
                                        <FormItem>
                                            <FormLabel>Bridge</FormLabel>
                                            <Select
                                                value={field.value}
                                                onValueChange={field.onChange}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="loopback">
                                                        loopback
                                                    </SelectItem>
                                                    <SelectItem value="webhook">
                                                        webhook
                                                    </SelectItem>
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
                                    name={`brokers.${i}.bridge.url`}
                                    render={({ field, fieldState }) => (
                                        <FormItem>
                                            <FormLabel>Bridge url</FormLabel>
                                            <Input
                                                value={field.value ?? ""}
                                                onChange={(e) =>
                                                    field.onChange(
                                                        e.target.value ||
                                                            undefined,
                                                    )
                                                }
                                            />
                                            <FormMessage>
                                                {fieldState.error?.message}
                                            </FormMessage>
                                        </FormItem>
                                    )}
                                />
                                <Button
                                    type="button"
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => brokers.remove(i)}
                                >
                                    Remove
                                </Button>
                            </div>
                        ))}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex-row items-center justify-between">
                        <CardTitle>Products</CardTitle>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => products.append(emptyProduct())}
                            data-testid="add-product"
                        >
                            Add product
                        </Button>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {products.fields.map((row, i) => (
                            <ProductFields
                                key={row.id}
                                index={i}
                                form={form}
                                brokerIds={brokerIds.filter(Boolean)}
                                onRemove={() => products.remove(i)}
                            />
                        ))}
                    </CardContent>
                </Card>

                <FormMessage>{form.formState.errors.root?.message}</FormMessage>
                <Button type="submit" disabled={saving} data-testid="firm-save">
                    Save
                </Button>
            </form>
        </Form>
    );
}

function ProductFields({
    index,
    form,
    brokerIds,
    onRemove,
}: {
    index: number;
    form: ReturnType<typeof useForm<FirmConfig>>;
    brokerIds: string[];
    onRemove: () => void;
}) {
    const phases = useFieldArray({
        control: form.control,
        name: `products.${index}.phases`,
    });
    return (
        <div className="space-y-3 rounded-lg border p-3">
            <div className="grid gap-3 sm:grid-cols-2">
                <FormField
                    control={form.control}
                    name={`products.${index}.id`}
                    render={({ field, fieldState }) => (
                        <FormItem>
                            <FormLabel htmlFor={`product-id-${index}`}>
                                Id
                            </FormLabel>
                            <Input
                                id={`product-id-${index}`}
                                data-testid={`product-id-${index}`}
                                {...field}
                            />
                            <FormMessage>
                                {fieldState.error?.message}
                            </FormMessage>
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name={`products.${index}.name`}
                    render={({ field, fieldState }) => (
                        <FormItem>
                            <FormLabel htmlFor={`product-name-${index}`}>
                                Name
                            </FormLabel>
                            <Input
                                id={`product-name-${index}`}
                                data-testid={`product-name-${index}`}
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
                name={`products.${index}.brokers`}
                render={({ field, fieldState }) => (
                    <FormItem>
                        <FormLabel>Brokers</FormLabel>
                        <div className="flex flex-wrap gap-3">
                            {brokerIds.map((id) => (
                                <div
                                    key={id}
                                    className="flex items-center gap-2 text-sm"
                                >
                                    <Checkbox
                                        id={`pb-${index}-${id}`}
                                        checked={field.value.includes(id)}
                                        onCheckedChange={(v) => {
                                            const on = v === true;
                                            field.onChange(
                                                on
                                                    ? [...field.value, id]
                                                    : field.value.filter(
                                                          (x) => x !== id,
                                                      ),
                                            );
                                        }}
                                    />
                                    <FormLabel
                                        htmlFor={`pb-${index}-${id}`}
                                        data-testid={`product-broker-${index}-${id}`}
                                    >
                                        {id}
                                    </FormLabel>
                                </div>
                            ))}
                        </div>
                        <FormMessage>{fieldState.error?.message}</FormMessage>
                    </FormItem>
                )}
            />
            <div className="grid gap-3 sm:grid-cols-3">
                <FormField
                    control={form.control}
                    name={`products.${index}.payout.split`}
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
                    name={`products.${index}.payout.mode`}
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
                                    {implementedPayoutModes.map((m) => (
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
                        name={`products.${index}.phases.${pi}.name`}
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
                        name={`products.${index}.phases.${pi}.kind`}
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
                        name={`products.${index}.phases.${pi}.balance`}
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
                        name={`products.${index}.phases.${pi}.fee`}
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
                            ["profitTarget", "Profit target"],
                            ["maxDrawdown", "Max drawdown"],
                            ["dailyDrawdown", "Daily drawdown"],
                            ["minTradingDays", "Min trading days"],
                        ] as const
                    ).map(([key, label]) => (
                        <FormField
                            key={key}
                            control={form.control}
                            name={`products.${index}.phases.${pi}.ruleset.${key}`}
                            render={({ field, fieldState }) => (
                                <FormItem>
                                    <FormLabel>{label}</FormLabel>
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
            <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={onRemove}
            >
                Remove product
            </Button>
        </div>
    );
}

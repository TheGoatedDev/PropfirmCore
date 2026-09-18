import {
    type FirmConfig,
    kycGates,
    onUncoverablePolicies,
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
import { useForm } from "react-hook-form";

type FirmSettings = Omit<FirmConfig, "brokers" | "products">;

export function FirmSettingsForm({
    firm,
    onSave,
    saving,
}: {
    firm: FirmConfig;
    onSave: (next: FirmSettings) => void;
    saving: boolean;
}) {
    const { brokers: _, products: __, ...settings } = firm;
    const form = useForm<FirmSettings>({
        defaultValues: settings,
        values: settings,
    });

    return (
        <Form {...form}>
            <form
                className="space-y-6"
                onSubmit={form.handleSubmit((v) => onSave(v))}
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
                            {(["affiliates", "multiBrand"] as const).map(
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
                            <FormField
                                control={form.control}
                                name="modules.kyc.enabled"
                                render={({ field }) => (
                                    <div className="flex items-center gap-2 text-sm">
                                        <Checkbox
                                            id="mod-kyc"
                                            data-testid="modules-kyc-enabled"
                                            checked={field.value}
                                            onCheckedChange={(v) =>
                                                field.onChange(v === true)
                                            }
                                        />
                                        <FormLabel htmlFor="mod-kyc">
                                            kyc
                                        </FormLabel>
                                    </div>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="modules.kyc.gate"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel htmlFor="mod-kyc-gate">
                                            KYC gate
                                        </FormLabel>
                                        <Select
                                            value={field.value}
                                            onValueChange={field.onChange}
                                        >
                                            <SelectTrigger
                                                id="mod-kyc-gate"
                                                data-testid="modules-kyc-gate"
                                            >
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {kycGates.map((g) => (
                                                    <SelectItem
                                                        key={g}
                                                        value={g}
                                                    >
                                                        {g}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </FormItem>
                                )}
                            />
                        </div>
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

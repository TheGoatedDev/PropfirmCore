import { zodResolver } from "@hookform/resolvers/zod";
import {
    checkoutProviders,
    type FirmConfig,
    type FirmSettings,
    firmSettingsSchema,
    kycGates,
    onUncoverablePolicies,
} from "@propfirmcore/config";
import {
    type Choice,
    ChoiceGroup,
} from "@propfirmcore/ui/components/choice-group";
import {
    Combobox,
    type ComboboxOption,
} from "@propfirmcore/ui/components/combobox";
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
import { Switch } from "@propfirmcore/ui/components/switch";
import { formatEnum } from "@propfirmcore/ui/lib/format";
import { useForm } from "react-hook-form";
import { useCan } from "./access.ts";

function utcOffset(tz: string): string {
    const part = new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        timeZoneName: "shortOffset",
    })
        .formatToParts(new Date())
        .find((p) => p.type === "timeZoneName")?.value;
    return (part ?? "GMT").replace("GMT", "UTC").replace("-", "−");
}

const timeZones: ComboboxOption[] = [
    "UTC",
    ...Intl.supportedValuesOf("timeZone"),
].map((tz) => ({
    value: tz,
    label: tz.replaceAll("_", " "),
    hint: utcOffset(tz),
}));

const currencyNames = new Intl.DisplayNames(["en"], { type: "currency" });
const currencies: ComboboxOption[] = Intl.supportedValuesOf("currency").map(
    (code) => ({
        value: code.toLowerCase(),
        label: currencyNames.of(code) ?? code,
        hint: code,
    }),
);

const providerHelp: Record<(typeof checkoutProviders)[number], string> = {
    manual: "An admin marks each payment paid from the Payments page.",
};

const uncoverableChoices: Choice[] = onUncoverablePolicies.map((p) => ({
    value: p,
    label: formatEnum(p),
    description:
        p === "failApprove"
            ? "Approving fails and the payout stays pending."
            : "The payout is rejected with reason Uncoverable.",
}));

const kycGateChoices: Choice[] = kycGates.map((g) => ({
    value: g,
    label: g === "payout" ? "Before payouts" : "Before funded",
    description:
        g === "payout"
            ? "Unverified traders cannot be sent cash."
            : "Unverified traders also cannot enter a funded phase.",
}));

function ModuleRow({
    id,
    label,
    description,
    checked,
    onCheckedChange,
    testId,
}: {
    id: string;
    label: string;
    description: string;
    checked: boolean;
    onCheckedChange: (v: boolean) => void;
    testId?: string;
}) {
    return (
        <div className="flex items-start justify-between gap-4 sm:col-span-2">
            <div className="space-y-0.5">
                <FormLabel htmlFor={id}>{label}</FormLabel>
                <FormDescription id={`${id}-desc`}>
                    {description}
                </FormDescription>
            </div>
            <Switch
                id={id}
                nativeButton
                render={<button type="button" />}
                aria-describedby={`${id}-desc`}
                data-testid={testId}
                checked={checked}
                onCheckedChange={onCheckedChange}
            />
        </div>
    );
}

export function FirmSettingsForm({
    firm,
    onSave,
    saving,
}: {
    firm: FirmConfig;
    onSave: (next: FirmSettings) => void;
    saving: boolean;
}) {
    const can = useCan();
    const { brokers: _, products: __, ...settings } = firm;
    const form = useForm<FirmSettings>({
        resolver: zodResolver(firmSettingsSchema),
        defaultValues: settings,
        values: settings,
        mode: "onTouched",
    });
    const dirty = form.formState.isDirty;
    const kycOn = form.watch("modules.kyc.enabled");
    const tz = form.watch("dailyClose.tz");
    const time = form.watch("dailyClose.time");

    return (
        <Form {...form}>
            <form
                noValidate
                onSubmit={form.handleSubmit((v) => onSave(v))}
                className="pb-4"
            >
                <SettingsSection
                    title="Identity"
                    description="The firm traders see on every page."
                >
                    <FormItem>
                        <FormLabel htmlFor="firm-id">Firm ID</FormLabel>
                        <Input
                            id="firm-id"
                            value={settings.id}
                            readOnly
                            aria-describedby="firm-id-desc"
                            className="bg-muted/50 text-muted-foreground"
                        />
                        <FormDescription id="firm-id-desc">
                            Set at install. It cannot change.
                        </FormDescription>
                    </FormItem>
                    <FormField
                        control={form.control}
                        name="name"
                        render={({ field, fieldState }) => (
                            <FormItem>
                                <FormLabel htmlFor="firm-name">Name</FormLabel>
                                <Input
                                    id="firm-name"
                                    data-testid="firm-name"
                                    maxLength={80}
                                    autoComplete="organization"
                                    aria-invalid={
                                        fieldState.invalid || undefined
                                    }
                                    {...field}
                                />
                                <FormMessage>
                                    {fieldState.error?.message}
                                </FormMessage>
                            </FormItem>
                        )}
                    />
                </SettingsSection>

                <SettingsSection
                    title="Trading day"
                    description="The daily close ends each trading day. Daily drawdown resets and trading days count from it."
                >
                    <FormField
                        control={form.control}
                        name="dailyClose.tz"
                        render={({ field, fieldState }) => (
                            <FormItem>
                                <FormLabel htmlFor="tz">Timezone</FormLabel>
                                <Combobox
                                    id="tz"
                                    data-testid="firm-tz"
                                    options={timeZones}
                                    value={field.value}
                                    onValueChange={(v) => {
                                        field.onChange(v ?? "");
                                        field.onBlur();
                                    }}
                                    placeholder="Search timezones"
                                    empty="No timezone matches."
                                    invalid={fieldState.invalid}
                                />
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
                                <Input
                                    id="close-time"
                                    type="time"
                                    step={60}
                                    data-testid="firm-close-time"
                                    aria-invalid={
                                        fieldState.invalid || undefined
                                    }
                                    {...field}
                                />
                                <FormMessage>
                                    {fieldState.error
                                        ? "Use 24-hour HH:MM."
                                        : null}
                                </FormMessage>
                            </FormItem>
                        )}
                    />
                    {tz && time ? (
                        <p className="text-sm text-muted-foreground sm:col-span-2">
                            Trading days end at{" "}
                            <span className="font-medium text-foreground tabular-nums">
                                {time}
                            </span>{" "}
                            {tz.replaceAll("_", " ")} ({utcOffsetSafe(tz)}).
                        </p>
                    ) : null}
                </SettingsSection>

                <SettingsSection
                    title="Checkout"
                    description="How traders pay fees, and the currency payments are taken in."
                >
                    <FormField
                        control={form.control}
                        name="checkout.provider"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel htmlFor="checkout-provider">
                                    Provider
                                </FormLabel>
                                <Select
                                    value={field.value}
                                    onValueChange={(v) => field.onChange(v)}
                                >
                                    <SelectTrigger
                                        id="checkout-provider"
                                        className="w-full"
                                    >
                                        <SelectValue>{formatEnum}</SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                        {checkoutProviders.map((p) => (
                                            <SelectItem key={p} value={p}>
                                                {formatEnum(p)}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <FormDescription>
                                    {providerHelp[field.value]}
                                </FormDescription>
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
                                <Combobox
                                    id="currency"
                                    data-testid="firm-currency"
                                    options={currencies}
                                    value={field.value.toLowerCase()}
                                    onValueChange={(v) => {
                                        field.onChange(v ?? "");
                                        field.onBlur();
                                    }}
                                    placeholder="Search currencies"
                                    empty="No currency matches."
                                    invalid={fieldState.invalid}
                                />
                                <FormMessage>
                                    {fieldState.error?.message}
                                </FormMessage>
                            </FormItem>
                        )}
                    />
                </SettingsSection>

                <SettingsSection
                    title="Payouts"
                    description="What approving does when the account can no longer cover the requested amount. A product can override this."
                >
                    <FormField
                        control={form.control}
                        name="payout.onUncoverable"
                        render={({ field }) => (
                            <FormItem className="sm:col-span-2">
                                <FormLabel id="uncoverable-label">
                                    When a payout is uncoverable
                                </FormLabel>
                                <ChoiceGroup
                                    aria-labelledby="uncoverable-label"
                                    data-testid="firm-uncoverable"
                                    choices={uncoverableChoices}
                                    value={field.value}
                                    onValueChange={field.onChange}
                                />
                            </FormItem>
                        )}
                    />
                </SettingsSection>

                <SettingsSection
                    title="Modules"
                    description="Optional parts of the platform. Off by default."
                >
                    <FormField
                        control={form.control}
                        name="modules.kyc.enabled"
                        render={({ field }) => (
                            <ModuleRow
                                id="mod-kyc"
                                testId="modules-kyc-enabled"
                                label="KYC"
                                description="Require a verified identity before money moves. Admins verify traders from Trading accounts."
                                checked={field.value}
                                onCheckedChange={field.onChange}
                            />
                        )}
                    />
                    {kycOn ? (
                        <FormField
                            control={form.control}
                            name="modules.kyc.gate"
                            render={({ field }) => (
                                <FormItem className="sm:col-span-2">
                                    <FormLabel id="kyc-gate-label">
                                        KYC gate
                                    </FormLabel>
                                    <ChoiceGroup
                                        aria-labelledby="kyc-gate-label"
                                        data-testid="modules-kyc-gate"
                                        choices={kycGateChoices}
                                        value={field.value}
                                        onValueChange={field.onChange}
                                    />
                                </FormItem>
                            )}
                        />
                    ) : null}
                    <FormField
                        control={form.control}
                        name="modules.affiliates"
                        render={({ field }) => (
                            <ModuleRow
                                id="mod-affiliates"
                                label="Affiliates"
                                description="Stored only. No feature reads this yet."
                                checked={field.value}
                                onCheckedChange={field.onChange}
                            />
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="modules.multiBrand"
                        render={({ field }) => (
                            <ModuleRow
                                id="mod-multi-brand"
                                label="Multi-brand"
                                description="Stored only. No feature reads this yet."
                                checked={field.value}
                                onCheckedChange={field.onChange}
                            />
                        )}
                    />
                </SettingsSection>

                {can("firm", "write") && (
                    <SaveBar
                        dirty={dirty}
                        saving={saving}
                        onDiscard={() => form.reset(settings)}
                        error={form.formState.errors.root?.message}
                        testId="firm-save"
                    />
                )}
            </form>
        </Form>
    );
}

function utcOffsetSafe(tz: string): string {
    try {
        return utcOffset(tz);
    } catch {
        return "unknown offset";
    }
}

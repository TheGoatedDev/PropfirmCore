import { zodResolver } from "@hookform/resolvers/zod";
import { type BrokerWrite, brokerWriteSchema } from "@propfirmcore/config";
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
import { SaveBar, SettingsSection } from "@propfirmcore/ui/components/settings";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { useCan } from "./access.ts";

export function emptyBroker(): BrokerWrite {
    return {
        name: "",
        bridge: { provider: "loopback" },
    };
}

const bridgeChoices: Choice[] = [
    {
        value: "loopback",
        label: "Loopback",
        description:
            "Runs inside this server. Provisions sim books with no outside broker.",
    },
    {
        value: "webhook",
        label: "Webhook",
        description:
            "Calls your bridge over HTTP to provision books, move sim, and freeze.",
    },
];

export function BrokerForm({
    broker,
    onSave,
    saving,
}: {
    broker: BrokerWrite;
    onSave: (next: BrokerWrite) => void;
    saving: boolean;
}) {
    const can = useCan();
    const form = useForm<
        z.input<typeof brokerWriteSchema>,
        unknown,
        BrokerWrite
    >({
        resolver: zodResolver(brokerWriteSchema),
        defaultValues: broker,
        values: broker,
        mode: "onTouched",
    });
    const locked = Boolean(broker.id);
    const webhook = form.watch("bridge.provider") === "webhook";

    return (
        <Form {...form}>
            <form noValidate onSubmit={form.handleSubmit((v) => onSave(v))}>
                <SettingsSection
                    title="Identity"
                    description="How this broker appears to admins and to traders choosing where to trade."
                >
                    {locked ? (
                        <FormItem>
                            <FormLabel htmlFor="broker-id">Broker ID</FormLabel>
                            <Input
                                id="broker-id"
                                data-testid="broker-id"
                                value={broker.id ?? ""}
                                readOnly
                                aria-describedby="broker-id-desc"
                                className="bg-muted/50 text-muted-foreground"
                            />
                            <FormDescription id="broker-id-desc">
                                Generated on create. It cannot change.
                            </FormDescription>
                        </FormItem>
                    ) : null}
                    <FormField
                        control={form.control}
                        name="name"
                        render={({ field, fieldState }) => (
                            <FormItem>
                                <FormLabel htmlFor="broker-name">
                                    Name
                                </FormLabel>
                                <Input
                                    id="broker-name"
                                    data-testid="broker-name"
                                    placeholder="e.g. Acme MT5"
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
                    title="Bridge"
                    description="How the platform reaches the broker to open books and move sim. The trader picks a broker at purchase and keeps it."
                >
                    <FormField
                        control={form.control}
                        name="bridge.provider"
                        render={({ field }) => (
                            <FormItem className="sm:col-span-2">
                                <FormLabel id="bridge-label">
                                    Connection
                                </FormLabel>
                                <ChoiceGroup
                                    aria-labelledby="bridge-label"
                                    data-testid="broker-bridge"
                                    choices={bridgeChoices}
                                    value={field.value ?? "loopback"}
                                    onValueChange={field.onChange}
                                />
                            </FormItem>
                        )}
                    />
                    {webhook ? (
                        <FormField
                            control={form.control}
                            name="bridge.url"
                            render={({ field, fieldState }) => (
                                <FormItem className="sm:col-span-2">
                                    <FormLabel htmlFor="bridge-url">
                                        Bridge URL
                                    </FormLabel>
                                    <Input
                                        id="bridge-url"
                                        type="url"
                                        inputMode="url"
                                        placeholder="https://bridge.example.com"
                                        data-testid="broker-bridge-url"
                                        aria-invalid={
                                            fieldState.invalid || undefined
                                        }
                                        value={field.value ?? ""}
                                        onBlur={field.onBlur}
                                        onChange={(e) =>
                                            field.onChange(
                                                e.target.value || undefined,
                                            )
                                        }
                                    />
                                    <FormMessage>
                                        {fieldState.error
                                            ? "Enter the bridge's full https:// URL."
                                            : null}
                                    </FormMessage>
                                </FormItem>
                            )}
                        />
                    ) : null}
                </SettingsSection>

                {can("firm", "write") && (
                    <SaveBar
                        dirty={form.formState.isDirty}
                        saving={saving}
                        onDiscard={() => form.reset(broker)}
                        error={form.formState.errors.root?.message}
                        saveLabel={locked ? "Save changes" : "Create broker"}
                        testId="broker-save"
                    />
                )}
            </form>
        </Form>
    );
}

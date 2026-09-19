import type { BrokerWrite } from "@propfirmcore/config";
import { Button } from "@propfirmcore/ui/components/button";
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

export function emptyBroker(): BrokerWrite {
    return {
        name: "",
        bridge: { provider: "loopback" },
    };
}

export function BrokerForm({
    broker,
    onSave,
    saving,
}: {
    broker: BrokerWrite;
    onSave: (next: BrokerWrite) => void;
    saving: boolean;
}) {
    const form = useForm<BrokerWrite>({
        defaultValues: broker,
        values: broker,
    });
    const locked = Boolean(broker.id);

    return (
        <Form {...form}>
            <form
                className="grid max-w-xl gap-3 sm:grid-cols-2"
                onSubmit={form.handleSubmit((v) => onSave(v))}
            >
                {locked ? (
                    <FormField
                        control={form.control}
                        name="id"
                        render={({ field, fieldState }) => (
                            <FormItem>
                                <FormLabel htmlFor="broker-id">Id</FormLabel>
                                <Input
                                    id="broker-id"
                                    data-testid="broker-id"
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
                            <FormLabel htmlFor="broker-name">Name</FormLabel>
                            <Input
                                id="broker-name"
                                data-testid="broker-name"
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
                    name="bridge.provider"
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
                    name="bridge.url"
                    render={({ field, fieldState }) => (
                        <FormItem>
                            <FormLabel>Bridge url</FormLabel>
                            <Input
                                value={field.value ?? ""}
                                onChange={(e) =>
                                    field.onChange(e.target.value || undefined)
                                }
                            />
                            <FormMessage>
                                {fieldState.error?.message}
                            </FormMessage>
                        </FormItem>
                    )}
                />
                <FormMessage className="sm:col-span-2">
                    {form.formState.errors.root?.message}
                </FormMessage>
                <Button
                    type="submit"
                    disabled={saving}
                    data-testid="broker-save"
                >
                    Save
                </Button>
            </form>
        </Form>
    );
}

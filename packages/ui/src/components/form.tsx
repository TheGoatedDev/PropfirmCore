import type { ComponentProps } from "react";
import {
    Controller,
    type ControllerProps,
    type FieldPath,
    type FieldValues,
    FormProvider,
} from "react-hook-form";
import { Label } from "@/components/label";
import { cn } from "@/lib/utils";

const Form = FormProvider;

function FormField<
    TFieldValues extends FieldValues = FieldValues,
    TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>(props: ControllerProps<TFieldValues, TName>) {
    return <Controller {...props} />;
}

function FormItem({ className, ...props }: ComponentProps<"div">) {
    return <div className={cn("space-y-1", className)} {...props} />;
}

function FormLabel({ className, ...props }: ComponentProps<"label">) {
    return <Label className={className} {...props} />;
}

function FormDescription({ className, ...props }: ComponentProps<"p">) {
    return (
        <p
            className={cn("text-sm text-muted-foreground", className)}
            {...props}
        />
    );
}

function FormMessage({ className, children, ...props }: ComponentProps<"p">) {
    if (!children) return null;
    return (
        <p
            role="alert"
            className={cn("text-sm text-destructive", className)}
            {...props}
        >
            {children}
        </p>
    );
}

export { Form, FormDescription, FormField, FormItem, FormLabel, FormMessage };

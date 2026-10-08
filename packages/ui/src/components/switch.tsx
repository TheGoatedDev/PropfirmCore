import { Switch as SwitchPrimitive } from "@base-ui/react/switch";

import { cn } from "@/lib/utils";

function Switch({ className, ...props }: SwitchPrimitive.Root.Props) {
    return (
        <SwitchPrimitive.Root
            data-slot="switch"
            className={cn(
                "inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-transparent bg-input p-0.5 transition-colors duration-150 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-checked:bg-brand motion-reduce:transition-none dark:bg-input/80 dark:data-checked:bg-brand",
                className,
            )}
            {...props}
        >
            <SwitchPrimitive.Thumb className="size-4 rounded-full bg-background shadow-sm transition-transform duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] data-checked:translate-x-4 motion-reduce:transition-none" />
        </SwitchPrimitive.Root>
    );
}

export { Switch };

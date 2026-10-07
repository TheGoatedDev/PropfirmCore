import { AlertDialog } from "@base-ui/react/alert-dialog";
import { TriangleAlert } from "lucide-react";
import {
    createContext,
    type ReactNode,
    useCallback,
    useContext,
    useRef,
    useState,
} from "react";

import { cn } from "@/lib/utils";

import { Button } from "./button";

export type ConfirmOptions = {
    title: string;
    description?: ReactNode;
    /** Names the action, e.g. "Delete broker". Never "OK" or "Yes". */
    confirmLabel: string;
    cancelLabel?: string;
    variant?: "default" | "destructive";
    /** data-testid on the confirm button. */
    testId?: string;
};

type Confirm = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<Confirm | null>(null);

/**
 * Mount once near the app root. `useConfirm()` then opens one shared dialog
 * and resolves true on confirm, false on cancel, Escape or backdrop.
 */
function ConfirmProvider({ children }: { children: ReactNode }) {
    const [options, setOptions] = useState<ConfirmOptions | null>(null);
    const [open, setOpen] = useState(false);
    const resolver = useRef<((ok: boolean) => void) | null>(null);

    const confirm = useCallback<Confirm>((next) => {
        resolver.current?.(false);
        setOptions(next);
        setOpen(true);
        return new Promise<boolean>((resolve) => {
            resolver.current = resolve;
        });
    }, []);

    function settle(ok: boolean) {
        resolver.current?.(ok);
        resolver.current = null;
        setOpen(false);
    }

    return (
        <ConfirmContext.Provider value={confirm}>
            {children}
            <ConfirmDialog
                open={open}
                options={options}
                onConfirm={() => settle(true)}
                onCancel={() => settle(false)}
            />
        </ConfirmContext.Provider>
    );
}

function useConfirm(): Confirm {
    const confirm = useContext(ConfirmContext);
    if (!confirm) throw new Error("useConfirm needs a ConfirmProvider");
    return confirm;
}

function ConfirmDialog({
    open,
    options,
    onConfirm,
    onCancel,
}: {
    open: boolean;
    options: ConfirmOptions | null;
    onConfirm: () => void;
    onCancel: () => void;
}) {
    const destructive = options?.variant === "destructive";
    return (
        <AlertDialog.Root
            open={open}
            onOpenChange={(next) => {
                if (!next) onCancel();
            }}
        >
            <AlertDialog.Portal>
                <AlertDialog.Backdrop className="fixed inset-0 z-50 bg-black/40 transition-opacity duration-150 ease-out data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 motion-reduce:transition-none dark:bg-black/60" />
                <AlertDialog.Popup
                    data-testid="confirm-dialog"
                    className="fixed top-1/2 left-1/2 z-50 grid w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl bg-popover p-5 text-sm text-popover-foreground shadow-lg ring-1 ring-foreground/10 transition-[opacity,scale] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] outline-none data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0 motion-reduce:transition-none"
                >
                    <div className="flex gap-3">
                        {destructive ? (
                            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-destructive-subtle text-destructive">
                                <TriangleAlert aria-hidden className="size-4" />
                            </span>
                        ) : null}
                        <div className="min-w-0 space-y-1.5 pt-1">
                            <AlertDialog.Title className="text-base leading-snug font-medium">
                                {options?.title}
                            </AlertDialog.Title>
                            {options?.description ? (
                                <AlertDialog.Description className="text-muted-foreground">
                                    {options.description}
                                </AlertDialog.Description>
                            ) : null}
                        </div>
                    </div>
                    <div
                        className={cn(
                            "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
                        )}
                    >
                        <AlertDialog.Close
                            render={
                                <Button
                                    variant="outline"
                                    data-testid="confirm-dialog-cancel"
                                />
                            }
                        >
                            {options?.cancelLabel ?? "Cancel"}
                        </AlertDialog.Close>
                        <Button
                            variant={destructive ? "destructive" : "default"}
                            data-testid={
                                options?.testId ?? "confirm-dialog-confirm"
                            }
                            onClick={onConfirm}
                        >
                            {options?.confirmLabel}
                        </Button>
                    </div>
                </AlertDialog.Popup>
            </AlertDialog.Portal>
        </AlertDialog.Root>
    );
}

export { ConfirmDialog, ConfirmProvider, useConfirm };

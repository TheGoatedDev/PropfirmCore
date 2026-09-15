import { Button } from "@propfirmcore/ui/components/button";
import { Input } from "@propfirmcore/ui/components/input";
import { Label } from "@propfirmcore/ui/components/label";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import type { FormEvent } from "react";
import { z } from "zod";
import { api, failMsg, keys } from "../../api.ts";
import { useUi } from "../../stores/ui.ts";

const paymentIdSchema = z.object({ paymentId: z.string().min(1) });

export const Route = createFileRoute("/_app/payments")({
    component: Payments,
    staticData: { crumb: "Payments" },
});

function Payments() {
    const setError = useUi((s) => s.setError);
    const qc = useQueryClient();
    const complete = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await api.POST("/payments/{id}/complete", {
                params: { path: { id } },
            });
            if (error) throw error;
        },
        onSuccess: async () => {
            await qc.invalidateQueries({ queryKey: keys.accounts });
        },
        onError: (error) => setError(failMsg(error, "Complete failed")),
    });

    async function submitComplete(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setError(null);
        const parsed = paymentIdSchema.safeParse({
            paymentId: String(
                new FormData(e.currentTarget).get("paymentId") ?? "",
            ),
        });
        if (!parsed.success) {
            setError(parsed.error.issues[0]?.message ?? "Invalid");
            return;
        }
        complete.mutate(parsed.data.paymentId);
    }

    return (
        <section>
            <h2 className="mb-3 text-lg font-medium">Complete payment</h2>
            <form
                className="flex items-end gap-3"
                onSubmit={(e) => void submitComplete(e)}
            >
                <div className="space-y-1">
                    <Label htmlFor="paymentId">Payment ID</Label>
                    <Input
                        id="paymentId"
                        name="paymentId"
                        data-testid="payment-complete-id"
                        required
                    />
                </div>
                <Button type="submit" data-testid="payment-complete-submit">
                    Complete
                </Button>
            </form>
        </section>
    );
}

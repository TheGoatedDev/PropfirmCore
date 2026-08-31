export type CreateCheckout = {
    paymentId: string;
    userId: string;
    productId: string;
    amount: number;
    currency: string;
};

export type CheckoutSession = {
    paymentId: string;
    redirectUrl: string | null;
    providerRef?: string;
};

export type VerifyInput =
    | { kind: "id"; paymentId: string; providerRef?: string }
    | { kind: "webhook"; headers: Headers; body: string };

export type VerifyResult =
    | { ok: true; paymentId: string; providerRef: string }
    | { ok: false; reason: string };

export type CheckoutAdapter = {
    create: (req: CreateCheckout) => Promise<CheckoutSession>;
    verify: (input: VerifyInput) => Promise<VerifyResult>;
};

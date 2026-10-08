import {
    Ban,
    Banknote,
    Check,
    CircleDot,
    Clock,
    Flag,
    type LucideIcon,
    TriangleAlert,
    X,
} from "lucide-react";
import type * as React from "react";

import { formatEnum } from "@/lib/format";

import { Badge } from "./badge";

type Tone = "success" | "warning" | "flag" | "info" | "destructive" | "outline";

// One look per domain status. The icon gives every tone a shape, so status
// never rests on color alone.
const statuses: Record<string, { tone: Tone; icon: LucideIcon }> = {
    // Trading account
    active: { tone: "info", icon: CircleDot },
    passed: { tone: "success", icon: Check },
    failed: { tone: "destructive", icon: X },
    // Payout and payment
    pending: { tone: "warning", icon: Clock },
    approved: { tone: "info", icon: Check },
    rejected: { tone: "destructive", icon: X },
    paid: { tone: "success", icon: Banknote },
    canceled: { tone: "outline", icon: Ban },
    // Breach severity
    warn: { tone: "warning", icon: TriangleAlert },
    flag: { tone: "flag", icon: Flag },
    fail: { tone: "destructive", icon: X },
    // User
    banned: { tone: "destructive", icon: Ban },
};

function StatusBadge({
    status,
    children,
    ...props
}: { status: string; children?: React.ReactNode } & Omit<
    React.ComponentProps<typeof Badge>,
    "variant" | "children"
>) {
    const known = statuses[status.toLowerCase()];
    const Icon = known?.icon;
    return (
        <Badge variant={known?.tone ?? "outline"} {...props}>
            {Icon ? <Icon aria-hidden data-icon="inline-start" /> : null}
            {children ?? formatEnum(status)}
        </Badge>
    );
}

export { StatusBadge };

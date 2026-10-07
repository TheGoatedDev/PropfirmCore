import { DateTime } from "luxon";

const locale = "en-US";

const amount = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

const percent = new Intl.NumberFormat(locale, {
    style: "percent",
    maximumFractionDigits: 2,
});

// Sim and cash amounts. No currency symbol: the trader API does not expose
// the firm currency, and Sim is not cash.
export function formatAmount(n: number): string {
    return amount.format(n);
}

// Rule fractions are 0–1 of start balance (ADR 0009).
export function formatPercent(fraction: number): string {
    return percent.format(fraction);
}

export function formatDateTime(iso: string, zone?: string): string {
    const dt = DateTime.fromISO(iso, zone ? { zone } : undefined);
    if (!dt.isValid) return iso;
    return dt
        .setLocale(locale)
        .toLocaleString(DateTime.DATETIME_MED_WITH_SECONDS);
}

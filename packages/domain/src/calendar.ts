import type { DailyClose } from "@propfirmcore/config";

function ymdParts(iso: string, tz: string): { date: string; hm: string } {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) throw new Error(`bad ts: ${iso}`);
    const fmt = new Intl.DateTimeFormat("en-CA", {
        timeZone: tz,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
    });
    const parts = Object.fromEntries(
        fmt.formatToParts(d).map((p) => [p.type, p.value]),
    );
    return {
        date: `${parts.year}-${parts.month}-${parts.day}`,
        hm: `${parts.hour}:${parts.minute}`,
    };
}

function shiftYmd(ymd: string, days: number): string {
    const [y, m, d] = ymd.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

// ponytail: Intl wall-clock, not a tz db. Fine until a firm needs session calendars in evaluate().
export function tradingDayKey(iso: string, dailyClose: DailyClose): string {
    const { date, hm } = ymdParts(iso, dailyClose.tz);
    return hm >= dailyClose.time ? shiftYmd(date, 1) : date;
}

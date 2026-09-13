import type { DailyClose } from "@propfirmcore/config";
import { DateTime } from "luxon";

export function tradingDayKey(iso: string, dailyClose: DailyClose): string {
    const dt = DateTime.fromISO(iso, { zone: dailyClose.tz });
    if (!dt.isValid) throw new Error(`bad ts: ${iso}`);
    const date = dt.toISODate();
    if (!date) throw new Error(`bad ts: ${iso}`);
    if (dt.toFormat("HH:mm") >= dailyClose.time) {
        const next = dt.plus({ days: 1 }).toISODate();
        if (!next) throw new Error(`bad ts: ${iso}`);
        return next;
    }
    return date;
}

export function isWeekend(iso: string, tz: string): boolean {
    const dt = DateTime.fromISO(iso, { zone: tz });
    if (!dt.isValid) throw new Error(`bad ts: ${iso}`);
    return dt.weekday >= 6;
}

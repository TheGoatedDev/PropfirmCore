import type { Ruleset } from "@propfirmcore/config";
import { DateTime } from "luxon";

export const behaviors = ["passEval", "blowMaxDd", "blowDailyDd"] as const;
export type Behavior = (typeof behaviors)[number];

export type Step =
    | { kind: "snapshot"; equity: number; balance: number; ts: string }
    | { kind: "fills"; ts: string };

export type Path = {
    steps: Step[];
    lastEquity: number;
    lastBalance: number;
    lastTs: string;
};

function plus(iso: string, duration: { days?: number; milliseconds?: number }) {
    const out = DateTime.fromISO(iso, { zone: "utc" }).plus(duration).toISO();
    if (!out) throw new Error(`bad ts: ${iso}`);
    return out;
}

export function addDays(iso: string, days: number): string {
    return plus(iso, { days });
}

export function addMs(iso: string, ms: number): string {
    return plus(iso, { milliseconds: ms });
}

function snap(equity: number, ts: string): Step {
    return { kind: "snapshot", equity, balance: equity, ts };
}

function lastSnapshot(steps: Step[]): Extract<Step, { kind: "snapshot" }> {
    for (let i = steps.length - 1; i >= 0; i--) {
        const s = steps[i];
        if (s?.kind === "snapshot") return s;
    }
    throw new Error("path has no snapshot");
}

export function planPath(input: {
    behavior: Behavior;
    startBalance: number;
    ruleset: Ruleset;
    originTs: string;
}): Path {
    const { behavior, startBalance, ruleset, originTs } = input;
    const steps: Step[] = [];

    if (behavior === "passEval") {
        const days = ruleset.minTradingDays;
        for (let i = 0; i < days; i++) {
            const ts = addDays(originTs, i);
            steps.push({ kind: "fills", ts });
            steps.push(snap(startBalance, ts));
        }
        const ts = addDays(originTs, Math.max(days - 1, 0));
        steps.push(snap(startBalance + ruleset.profitTarget, ts));
    } else if (behavior === "blowMaxDd") {
        steps.push({ kind: "fills", ts: originTs });
        steps.push(snap(startBalance - ruleset.maxDrawdown, originTs));
    } else {
        steps.push({ kind: "fills", ts: originTs });
        steps.push(snap(startBalance - ruleset.dailyDrawdown, originTs));
    }

    const last = lastSnapshot(steps);
    return {
        steps,
        lastEquity: last.equity,
        lastBalance: last.balance,
        lastTs: last.ts,
    };
}

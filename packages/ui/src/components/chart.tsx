import { barX, barY, defineChart, lineY, ruleY, text } from "@tanstack/charts";
import { Chart } from "@tanstack/charts/react";
import { scaleBand } from "@tanstack/charts/scales/band";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { tooltip } from "@tanstack/charts/tooltip";
import { Table2 } from "lucide-react";
import { type ReactNode, useId, useMemo, useState } from "react";

import { cn } from "@/lib/utils";

import { Button } from "./button";
import {
    Card,
    CardAction,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "./card";

/*
 * Charts render with TanStack Charts (`@tanstack/charts`). Never shadcn/ui
 * charts or Recharts. Specs follow the dataviz method: bars <= 24px with a
 * 4px rounded data end, a 2px surface gap between stacked segments (a stroke
 * in the card colour), solid hairline grid, and text in text tokens. Each
 * chart pairs with an HTML legend (status icons) and a table view, because
 * the SVG legend is hidden from assistive tech.
 */

export type ChartSeries = {
    key: string;
    label: string;
    /** A CSS colour, normally a `var(--chart-*)` token. */
    color: string;
    icon?: ReactNode;
};

const compact = new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
});
const whole = new Intl.NumberFormat("en-US");

// Text and grid inherit `currentColor`; the card sets it to muted ink.
// Tooltip variables map the built-in tooltip onto the popover tokens.
const chartClass =
    "text-muted-foreground [&_text]:text-[11px] [--ts-chart-tooltip-background:var(--popover)] [--ts-chart-tooltip-color:var(--popover-foreground)] [--ts-chart-tooltip-border:1px_solid_var(--border)] [--ts-chart-tooltip-border-radius:var(--radius-lg)] [--ts-chart-tooltip-font:500_12px/1.4_ui-sans-serif,system-ui,sans-serif]";
const surfaceGap = { stroke: "var(--card)", strokeWidth: 2 } as const;

export function ChartLegend({ series }: { series: ChartSeries[] }) {
    return (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {series.map((s) => (
                <li key={s.key} className="flex items-center gap-1.5">
                    <span
                        aria-hidden
                        className="size-2.5 rounded-[3px]"
                        style={{ background: s.color }}
                    />
                    {s.icon}
                    {s.label}
                </li>
            ))}
        </ul>
    );
}

/**
 * Columns over an ordered x (days). One series: neutral ink, the last column
 * in the foreground as emphasis. Several series: stacked, legend required.
 */
export function ColumnChart({
    categories,
    labels,
    series,
    data,
    height = 176,
    emphasizeLast = false,
    title,
}: {
    categories: string[];
    /** Display label per category, used on the axis and in tooltips. */
    labels: string[];
    series: ChartSeries[];
    /** data[seriesKey][i] */
    data: Record<string, number[]>;
    height?: number;
    emphasizeLast?: boolean;
    title: string;
}) {
    const definition = useMemo(() => {
        const last = categories.length - 1;
        const rows = series.flatMap((s) =>
            categories.map((_, i) => ({
                day: labels[i] ?? "",
                series: s.label,
                value: data[s.key]?.[i] ?? 0,
                fill:
                    series.length === 1 && emphasizeLast && i === last
                        ? "var(--foreground)"
                        : s.color,
            })),
        );
        // Every third day, counted back from today, so labels never collide.
        const tickDays = labels.filter((_, i) => (last - i) % 3 === 0);
        return defineChart({
            marks: [
                barY(rows, {
                    x: "day",
                    y: "value",
                    z: "series",
                    fill: (r) => r.fill,
                    maxThickness: 24,
                    radius: { end: 4 },
                    ...(series.length > 1 ? surfaceGap : {}),
                }),
            ],
            scales: {
                x: {
                    scale: () => scaleBand<string>().padding(0.3),
                    axis: { ticks: { values: tickDays } },
                },
                y: {
                    scale: scaleLinear,
                    nice: true,
                    grid: { strokeOpacity: 0.15 },
                    axis: {
                        line: false,
                        ticks: {
                            count: 4,
                            format: (v: number) => compact.format(v),
                        },
                    },
                },
            },
            focus: "group-x",
            tooltip: {
                use: tooltip,
                items: [
                    { channel: "x", label: "Day" },
                    {
                        channel: "y",
                        label:
                            series.length === 1
                                ? (series[0]?.label ?? "")
                                : "Count",
                        text: (pt) => whole.format(pt.yValue),
                    },
                    ...(series.length > 1 ? (["group"] as const) : []),
                ],
            },
        });
    }, [categories, labels, series, data, emphasizeLast]);

    return (
        <Chart
            definition={definition}
            height={height}
            ariaLabel={title}
            ariaDescription="Use the table view for exact values."
            className={chartClass}
        />
    );
}

/** Horizontal stacked bars: one row per category, segments per series. */
export function StackedBars({
    rows,
    series,
    title,
}: {
    rows: { key: string; label: string; values: Record<string, number> }[];
    series: ChartSeries[];
    title: string;
}) {
    const definition = useMemo(() => {
        const segments = rows.flatMap((r) =>
            series.map((s) => ({
                category: r.label,
                series: s.label,
                value: r.values[s.key] ?? 0,
                fill: s.color,
            })),
        );
        const totals = rows.map((r) => ({
            category: r.label,
            total: series.reduce((n, s) => n + (r.values[s.key] ?? 0), 0),
        }));
        return defineChart({
            marks: [
                barX(segments, {
                    x: "value",
                    y: "category",
                    z: "series",
                    fill: (d) => d.fill,
                    maxThickness: 16,
                    radius: { end: 4 },
                    ...surfaceGap,
                }),
                text(totals, {
                    x: "total",
                    y: "category",
                    text: (d) => whole.format(d.total),
                    anchor: "start",
                    dx: 6,
                    fill: "var(--foreground)",
                    fontWeight: 500,
                }),
            ],
            scales: {
                y: {
                    scale: () => scaleBand<string>().padding(0.35),
                    axis: { line: false, ticks: { size: 0 } },
                },
                x: {
                    scale: scaleLinear,
                    nice: true,
                    grid: { strokeOpacity: 0.15 },
                    axis: {
                        line: false,
                        ticks: {
                            count: 4,
                            format: (v: number) => compact.format(v),
                        },
                    },
                },
            },
            focus: "nearest-y",
            tooltip: {
                use: tooltip,
                items: [
                    // Stacked segments report their own length, not the stack end.
                    { channel: "x", label: "Accounts" },
                ],
            },
        });
    }, [rows, series]);

    return (
        <Chart
            definition={definition}
            height={Math.max(96, rows.length * 44 + 32)}
            ariaLabel={title}
            ariaDescription="Use the table view for exact values."
            className={chartClass}
        />
    );
}

export type ChartReference = {
    key: string;
    label: string;
    value: number;
    color: string;
};

/**
 * A value over real time (x is epoch ms), with dashed reference lines for
 * limits. Reference values belong in the legend: rules get no tooltip.
 */
export function LineChart({
    points,
    references = [],
    label,
    title,
    formatValue,
    formatTime,
    height = 220,
}: {
    points: { t: number; value: number }[];
    references?: ChartReference[];
    /** Series name for the tooltip, e.g. "Equity". */
    label: string;
    title: string;
    formatValue: (v: number) => string;
    formatTime: (t: number) => string;
    height?: number;
}) {
    const definition = useMemo(
        () =>
            defineChart({
                marks: [
                    ...references.map((r) =>
                        ruleY([r.value], {
                            id: `ref-${r.key}`,
                            stroke: r.color,
                            strokeOpacity: 0.9,
                            strokeWidth: 1.5,
                            strokeDasharray: "4 3",
                        }),
                    ),
                    lineY(points, {
                        x: "t",
                        y: "value",
                        stroke: "var(--foreground)",
                        strokeWidth: 2,
                    }),
                ],
                scales: {
                    x: {
                        scale: scaleLinear,
                        axis: {
                            line: false,
                            ticks: { count: 4, format: formatTime },
                        },
                    },
                    y: {
                        scale: scaleLinear,
                        nice: true,
                        grid: { strokeOpacity: 0.15 },
                        axis: {
                            line: false,
                            ticks: {
                                count: 4,
                                format: (v: number) => compact.format(v),
                            },
                        },
                    },
                },
                focus: "nearest-x",
                tooltip: {
                    use: tooltip,
                    items: [
                        {
                            channel: "x",
                            label: "Time",
                            text: (pt) => formatTime(pt.xValue),
                        },
                        {
                            channel: "y",
                            label,
                            text: (pt) => formatValue(pt.yValue),
                        },
                    ],
                },
            }),
        [points, references, label, formatValue, formatTime],
    );
    return (
        <Chart
            definition={definition}
            height={height}
            ariaLabel={title}
            ariaDescription="Use the table view for exact values."
            className={chartClass}
        />
    );
}

/** Legend for dashed reference lines, with each value. */
export function ReferenceLegend({
    references,
    formatValue,
}: {
    references: ChartReference[];
    formatValue: (v: number) => string;
}) {
    return (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <li className="flex items-center gap-1.5">
                <span
                    aria-hidden
                    className="h-0.5 w-4 rounded-full bg-foreground"
                />
                Equity
            </li>
            {references.map((r) => (
                <li key={r.key} className="flex items-center gap-1.5">
                    <span
                        aria-hidden
                        className="w-4 border-t-[1.5px] border-dashed"
                        style={{ borderColor: r.color }}
                    />
                    {r.label}
                    <span className="font-medium text-foreground tabular-nums">
                        {formatValue(r.value)}
                    </span>
                </li>
            ))}
        </ul>
    );
}

/**
 * A chart card: title, description, legend, and a Table toggle that swaps the
 * chart for its table twin.
 */
export function ChartCard({
    title,
    description,
    legend,
    chart,
    table,
    className,
}: {
    title: string;
    description?: ReactNode;
    legend?: ReactNode;
    chart: ReactNode;
    table: { columns: string[]; rows: (string | number)[][] };
    className?: string;
}) {
    const [asTable, setAsTable] = useState(false);
    const id = useId();
    return (
        <Card className={className}>
            <CardHeader>
                <CardTitle id={id}>{title}</CardTitle>
                {description ? (
                    <CardDescription>{description}</CardDescription>
                ) : null}
                <CardAction>
                    <Button
                        variant="ghost"
                        size="xs"
                        aria-pressed={asTable}
                        onClick={() => setAsTable((v) => !v)}
                    >
                        <Table2 />
                        {asTable ? "Chart" : "Table"}
                    </Button>
                </CardAction>
            </CardHeader>
            <CardContent className="space-y-3">
                {asTable ? (
                    <div className="max-h-72 overflow-auto">
                        <table
                            aria-labelledby={id}
                            className="w-full text-sm tabular-nums"
                        >
                            <thead>
                                <tr className="border-b text-left text-muted-foreground">
                                    {table.columns.map((c, i) => (
                                        <th
                                            key={c}
                                            className={cn(
                                                "py-1.5 font-medium",
                                                i > 0 && "text-right",
                                            )}
                                        >
                                            {c}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {table.rows.map((r) => (
                                    <tr
                                        key={String(r[0])}
                                        className="border-b last:border-0"
                                    >
                                        {r.map((v, i) => (
                                            <td
                                                key={`${r[0]}-${table.columns[i]}`}
                                                className={cn(
                                                    "py-1.5",
                                                    i > 0 && "text-right",
                                                )}
                                            >
                                                {typeof v === "number"
                                                    ? whole.format(v)
                                                    : v}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <>
                        {chart}
                        {legend}
                    </>
                )}
            </CardContent>
        </Card>
    );
}

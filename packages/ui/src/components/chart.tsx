import { Table2 } from "lucide-react";
import {
    type ReactNode,
    useId,
    useLayoutEffect,
    useRef,
    useState,
} from "react";

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
 * Small hand-built SVG charts. Specs follow the dataviz method: bars <= 24px
 * with a 4px rounded data end and a square baseline, 2px surface gaps between
 * stacked segments, hairline solid grid, text in text tokens (never the series
 * colour), a legend for >= 2 series, hover + focus tooltips, and a table view.
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

/** Round tick step (1, 2 or 5 x 10^n) giving about four intervals. */
function niceTicks(max: number): number[] {
    if (max <= 0) return [0, 1, 2, 3, 4];
    const raw = max / 4;
    const mag = 10 ** Math.floor(Math.log10(raw));
    const step = Math.max(
        1,
        [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw,
    );
    const top = Math.ceil(max / step) * step;
    return Array.from(
        { length: Math.round(top / step) + 1 },
        (_, i) => i * step,
    );
}

function useWidth<T extends HTMLElement>() {
    const ref = useRef<T>(null);
    const [width, setWidth] = useState(0);
    useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return;
        setWidth(el.clientWidth);
        const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
        ro.observe(el);
        return () => ro.disconnect();
    }, []);
    return [ref, width] as const;
}

/** Rect with only the top corners (or right corners) rounded. */
function barPath(
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
    end: "top" | "right" | "none",
): string {
    if (w <= 0 || h <= 0) return "";
    const rr = Math.min(r, w / 2, h / 2);
    if (end === "top") {
        return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
    }
    if (end === "right") {
        return `M${x},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h - rr}Q${x + w},${y + h} ${x + w - rr},${y + h}H${x}Z`;
    }
    return `M${x},${y}h${w}v${h}h${-w}Z`;
}

type Tip = {
    x: number;
    y: number;
    title: string;
    rows: { s: ChartSeries; v: number }[];
};

function Tooltip({ tip, width }: { tip: Tip | null; width: number }) {
    if (!tip) return null;
    // Keep the tooltip inside the chart; cards clip overflow.
    const x = Math.min(Math.max(tip.x, 76), Math.max(76, width - 76));
    return (
        <div
            role="presentation"
            className="pointer-events-none absolute z-10 min-w-36 -translate-x-1/2 -translate-y-full rounded-lg bg-popover px-2.5 py-2 text-xs text-popover-foreground shadow-md ring-1 ring-foreground/10"
            style={{ left: x, top: tip.y - 8 }}
        >
            <div className="mb-1 text-muted-foreground">{tip.title}</div>
            {tip.rows.map(({ s, v }) => (
                <div key={s.key} className="flex items-center gap-2">
                    <span
                        aria-hidden
                        className="h-0.5 w-3 rounded-full"
                        style={{ background: s.color }}
                    />
                    <span className="font-medium tabular-nums">
                        {whole.format(v)}
                    </span>
                    <span className="text-muted-foreground">{s.label}</span>
                </div>
            ))}
        </div>
    );
}

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
    height = 168,
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
    const [ref, width] = useWidth<HTMLDivElement>();
    const [tip, setTip] = useState<Tip | null>(null);
    const left = 36;
    const bottom = 22;
    const top = 8;
    const plotW = Math.max(0, width - left);
    const plotH = height - bottom - top;
    const totals = categories.map((_, i) =>
        series.reduce((n, s) => n + (data[s.key]?.[i] ?? 0), 0),
    );
    const ticks = niceTicks(Math.max(0, ...totals));
    const max = ticks[ticks.length - 1] ?? 1;
    const band = categories.length ? plotW / categories.length : 0;
    const barW = Math.min(24, band * 0.6);
    const y = (v: number) => top + plotH - (v / max) * plotH;
    const labelEvery = Math.max(
        1,
        Math.ceil(categories.length / Math.max(1, Math.floor(plotW / 56))),
    );

    function show(i: number) {
        setTip({
            x: left + band * i + band / 2,
            y: y(totals[i]),
            title: labels[i],
            rows: series.map((s) => ({ s, v: data[s.key]?.[i] ?? 0 })),
        });
    }

    return (
        <div
            ref={ref}
            className="relative w-full"
            onPointerLeave={() => setTip(null)}
        >
            {width > 0 ? (
                <svg
                    width={width}
                    height={height}
                    role="img"
                    aria-label={`${title}. Use the table view for exact values.`}
                    className="block overflow-visible"
                >
                    {ticks.map((t) => (
                        <g key={t}>
                            <line
                                x1={left}
                                x2={width}
                                y1={y(t)}
                                y2={y(t)}
                                className="stroke-border"
                                strokeWidth={1}
                            />
                            <text
                                x={left - 6}
                                y={y(t)}
                                dy="0.32em"
                                textAnchor="end"
                                className="fill-muted-foreground text-[10px] tabular-nums"
                            >
                                {compact.format(t)}
                            </text>
                        </g>
                    ))}
                    {categories.map((c, i) => {
                        const x = left + band * i + (band - barW) / 2;
                        let acc = 0;
                        const visible = series.filter(
                            (s) => (data[s.key]?.[i] ?? 0) > 0,
                        );
                        const last = visible[visible.length - 1];
                        return (
                            // biome-ignore lint/a11y/useSemanticElements: an SVG group is the column's focus target
                            <g
                                key={c}
                                role="button"
                                tabIndex={0}
                                aria-label={`${labels[i]}: ${series
                                    .map(
                                        (s) =>
                                            `${whole.format(data[s.key]?.[i] ?? 0)} ${s.label}`,
                                    )
                                    .join(", ")}`}
                                className="outline-none [&:focus-visible>rect:first-child]:fill-muted"
                                onPointerEnter={() => show(i)}
                                onFocus={() => show(i)}
                                onBlur={() => setTip(null)}
                            >
                                <rect
                                    x={left + band * i}
                                    y={top}
                                    width={band}
                                    height={plotH}
                                    className={cn(
                                        "fill-transparent",
                                        tip?.title === labels[i] &&
                                            "fill-muted/60",
                                    )}
                                />
                                {visible.map((s) => {
                                    const v = data[s.key]?.[i] ?? 0;
                                    const y0 = y(acc);
                                    acc += v;
                                    const y1 = y(acc);
                                    const isTop = s === last;
                                    const gap = isTop ? 0 : 2;
                                    const fill =
                                        series.length === 1 &&
                                        emphasizeLast &&
                                        i === categories.length - 1
                                            ? "var(--foreground)"
                                            : s.color;
                                    return (
                                        <path
                                            key={s.key}
                                            d={barPath(
                                                x,
                                                y1 + gap,
                                                barW,
                                                y0 - y1 - gap,
                                                4,
                                                isTop ? "top" : "none",
                                            )}
                                            style={{ fill }}
                                        />
                                    );
                                })}
                            </g>
                        );
                    })}
                    {categories.map((c, i) =>
                        i % labelEvery === 0 || i === categories.length - 1 ? (
                            <text
                                key={c}
                                x={left + band * i + band / 2}
                                y={height - 6}
                                textAnchor="middle"
                                className="fill-muted-foreground text-[10px]"
                            >
                                {labels[i]}
                            </text>
                        ) : null,
                    )}
                </svg>
            ) : (
                <div style={{ height }} />
            )}
            <Tooltip tip={tip} width={width} />
        </div>
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
    const [ref, width] = useWidth<HTMLDivElement>();
    const [tip, setTip] = useState<Tip | null>(null);
    const totals = rows.map((r) =>
        series.reduce((n, s) => n + (r.values[s.key] ?? 0), 0),
    );
    const max = Math.max(1, ...totals);
    const valueW = 48;
    const barH = 16;
    const rowH = 44;
    const trackW = Math.max(0, width - valueW);

    return (
        <div
            ref={ref}
            className="relative w-full"
            onPointerLeave={() => setTip(null)}
        >
            {width > 0 ? (
                <svg
                    width={width}
                    height={rows.length * rowH}
                    role="img"
                    aria-label={`${title}. Use the table view for exact values.`}
                    className="block overflow-visible"
                >
                    {rows.map((r, ri) => {
                        const y0 = ri * rowH + 18;
                        let acc = 0;
                        const visible = series.filter(
                            (s) => (r.values[s.key] ?? 0) > 0,
                        );
                        const last = visible[visible.length - 1];
                        return (
                            <g key={r.key}>
                                <text
                                    x={0}
                                    y={y0 - 6}
                                    className="fill-foreground text-xs"
                                >
                                    {r.label}
                                </text>
                                {visible.map((s) => {
                                    const v = r.values[s.key] ?? 0;
                                    const x = (acc / max) * trackW;
                                    acc += v;
                                    const w =
                                        (v / max) * trackW -
                                        (s === last ? 0 : 2);
                                    return (
                                        // biome-ignore lint/a11y/useSemanticElements: an SVG path is the segment's focus target
                                        <path
                                            key={s.key}
                                            role="button"
                                            tabIndex={0}
                                            aria-label={`${r.label}, ${s.label}: ${whole.format(v)}`}
                                            d={barPath(
                                                x,
                                                y0,
                                                Math.max(w, 1),
                                                barH,
                                                4,
                                                s === last ? "right" : "none",
                                            )}
                                            style={{ fill: s.color }}
                                            className="outline-none hover:opacity-80 focus-visible:opacity-80"
                                            onPointerEnter={() =>
                                                setTip({
                                                    x: x + w / 2,
                                                    y: y0,
                                                    title: r.label,
                                                    rows: [{ s, v }],
                                                })
                                            }
                                            onFocus={() =>
                                                setTip({
                                                    x: x + w / 2,
                                                    y: y0,
                                                    title: r.label,
                                                    rows: [{ s, v }],
                                                })
                                            }
                                            onBlur={() => setTip(null)}
                                        />
                                    );
                                })}
                                <text
                                    x={width}
                                    y={y0 + barH / 2}
                                    dy="0.32em"
                                    textAnchor="end"
                                    className="fill-foreground text-xs font-medium tabular-nums"
                                >
                                    {whole.format(totals[ri])}
                                </text>
                            </g>
                        );
                    })}
                </svg>
            ) : (
                <div style={{ height: rows.length * rowH }} />
            )}
            <Tooltip tip={tip} width={width} />
        </div>
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

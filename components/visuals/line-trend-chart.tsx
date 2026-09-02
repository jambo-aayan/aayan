"use client";

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import type { ComponentProps } from "react";

/** Extra fields beyond `label`/`value` pass straight through into
 * Recharts' tooltip `payload[0].payload` — a caller with its own custom
 * tooltip content (Finance's cashflow trend chart, see
 * components/finance-dashboard/trend-chart.tsx) can carry along whatever
 * it needs to render (e.g. the original Date, an unrounded value) without
 * this component needing to know about it. */
export type LineTrendPoint = { label: string; value: number } & Record<string, unknown>;

/** The shared Recharts line-chart core (#164/#171, ADR-0017) — one
 * LineChart/Line/axes/Tooltip setup used both by DateSeriesChartVisual's
 * own LINE case and, via Finance's own wrapper, the cashflow trend chart
 * — each customizing only what actually differs in its own established
 * look (dots, line weight/cap/join, curve interpolation, tooltip
 * content/styling, the hover cursor guide line) through props, rather
 * than two separate hand-rolled implementations. Every prop defaults to
 * DateSeriesChartVisual's own existing look (labeled axes, a dot at every
 * point, a 2px monotone line with default cap/join, Recharts' own
 * default tooltip/cursor) so that component's own appearance is
 * unchanged by this extraction — Finance's trend chart opts into its own
 * different established look (axis-free, thicker round-capped straight
 * segments, a custom tooltip) explicitly via props instead. */
export function LineTrendChart({
  points,
  height = 180,
  color = "var(--coral)",
  showAxes = true,
  dot = { r: 3 },
  activeDot,
  strokeWidth = 2,
  strokeLinecap,
  strokeLinejoin,
  curveType = "monotone",
  tooltipContent,
  cursor,
}: {
  points: LineTrendPoint[];
  height?: number;
  color?: string;
  showAxes?: boolean;
  dot?: ComponentProps<typeof Line>["dot"];
  activeDot?: ComponentProps<typeof Line>["activeDot"];
  strokeWidth?: number;
  strokeLinecap?: ComponentProps<typeof Line>["strokeLinecap"];
  strokeLinejoin?: ComponentProps<typeof Line>["strokeLinejoin"];
  curveType?: ComponentProps<typeof Line>["type"];
  tooltipContent?: ComponentProps<typeof Tooltip>["content"];
  cursor?: ComponentProps<typeof Tooltip>["cursor"];
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={points}>
        {showAxes && <XAxis dataKey="label" tick={{ fontSize: 11 }} />}
        {showAxes && <YAxis tick={{ fontSize: 11 }} width={32} />}
        <Tooltip content={tooltipContent} cursor={cursor} />
        <Line
          type={curveType}
          dataKey="value"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap={strokeLinecap}
          strokeLinejoin={strokeLinejoin}
          dot={dot}
          activeDot={activeDot}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

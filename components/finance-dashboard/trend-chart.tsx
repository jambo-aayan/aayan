"use client";

import type { TooltipContentProps } from "recharts";
import { LineTrendChart, type LineTrendPoint } from "@/components/visuals/line-trend-chart";
import styles from "./dashboard.module.css";
import { CHART_COLORS } from "@/lib/finance/palette";
import { formatGBP } from "@/lib/finance/format";
import type { CashFlowPoint } from "@/lib/finance/cash-flow-trend";

const VIEW_HEIGHT = 120;

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

type TrendTooltipPoint = LineTrendPoint & { date: Date; cumulative: number };

/** Same markup/CSS classes the old hand-rolled tooltip used
 * (dashboard.module.css's chartTooltip/-Date/-Value) — only how it's
 * triggered and positioned changed (Recharts' own Tooltip content
 * render-prop instead of a hand-tracked hoverX + percentage-clamped
 * `left`), not how it looks. */
function TrendTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0].payload as TrendTooltipPoint;
  return (
    <div className={styles.chartTooltip}>
      <div className={styles.chartTooltipDate}>{formatDate(point.date)}</div>
      <div className={styles.chartTooltipValue}>{formatGBP(point.cumulative)}</div>
    </div>
  );
}

/** Finance's cashflow trend chart (#153/#171, ADR-0017) — now rendered
 * through the shared LineTrendChart core DateSeriesChartVisual's own LINE
 * case also uses (#164), in place of a hand-rolled `<polyline>` +
 * manually-tracked hover-x SVG. `showAxes={false}` and `dot={false}`
 * preserve this chart's own established bare-line look (no tick labels,
 * no per-point dots — only #164's chart shows those); `strokeWidth={3}`
 * plus round cap/join and `curveType="linear"` reproduce the old
 * `<polyline>`'s own exact stroke (3px, round-capped/joined, straight
 * segments between points — not the shared component's own default 2px
 * monotone-spline look); the hover guide line and marker dot come from
 * Tooltip's `cursor` and Line's `activeDot`, replacing the old manual
 * `<line>`/`<circle>` pair with Recharts' own equivalents. */
export function TrendChart({ points }: { points: CashFlowPoint[] }) {
  if (points.length < 2) {
    return (
      <div className={`${styles.bentoCard} ${styles.span4} ${styles.row2}`}>
        <div className={styles.cardHead}>Cash flow</div>
        <p style={{ fontSize: 13, color: "var(--muted)" }}>
          Log a few Transactions to see a trend here.
        </p>
      </div>
    );
  }

  const chartPoints: TrendTooltipPoint[] = points.map((p) => ({
    label: formatDate(p.date),
    value: p.cumulative,
    date: p.date,
    cumulative: p.cumulative,
  }));
  const values = points.map((p) => p.cumulative);

  return (
    <div className={`${styles.bentoCard} ${styles.span4} ${styles.row2}`}>
      <div className={styles.cardHead}>Cash flow (from Transactions)</div>
      <div
        className={styles.chartWrap}
        role="img"
        aria-label={`Cumulative cash flow trend from ${formatGBP(values[0])} to ${formatGBP(values[values.length - 1])}`}
      >
        <LineTrendChart
          points={chartPoints}
          height={VIEW_HEIGHT}
          color={CHART_COLORS.coral}
          showAxes={false}
          dot={false}
          activeDot={{ r: 4, fill: CHART_COLORS.coral }}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          curveType="linear"
          tooltipContent={TrendTooltip}
          cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
        />
      </div>
    </div>
  );
}

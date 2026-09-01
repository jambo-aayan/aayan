"use client";

import { useState } from "react";
import styles from "./dashboard.module.css";
import { CHART_COLORS } from "@/lib/finance/palette";
import { formatGBP } from "@/lib/finance/format";
import { nearestCashFlowPoint, type CashFlowPoint } from "@/lib/finance/cash-flow-trend";

const VIEW_WIDTH = 400;
const VIEW_HEIGHT = 120;

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

export function TrendChart({ points }: { points: CashFlowPoint[] }) {
  const [hoverX, setHoverX] = useState<number | null>(null);

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

  const values = points.map((p) => p.cumulative);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  function xFor(index: number): number {
    return (index / (points.length - 1)) * VIEW_WIDTH;
  }
  function yFor(cumulative: number): number {
    return VIEW_HEIGHT - ((cumulative - min) / range) * (VIEW_HEIGHT - 10) - 5;
  }

  const coords = points.map((p, i) => `${xFor(i).toFixed(1)},${yFor(p.cumulative).toFixed(1)}`).join(" ");
  const hovered = hoverX === null ? null : nearestCashFlowPoint(points, hoverX, VIEW_WIDTH);

  function xFromClientX(target: SVGSVGElement, clientX: number): number {
    const rect = target.getBoundingClientRect();
    return ((clientX - rect.left) / rect.width) * VIEW_WIDTH;
  }

  function handleMove(e: React.MouseEvent<SVGSVGElement>) {
    setHoverX(xFromClientX(e.currentTarget, e.clientX));
  }

  // Touch has no hover state, so this is the only way a phone (very
  // plausibly where this dashboard actually gets checked) gets access to
  // per-point values at all, not a nice-to-have on top of mouse support.
  function handleTouchMove(e: React.TouchEvent<SVGSVGElement>) {
    const touch = e.touches[0];
    if (!touch) return;
    setHoverX(xFromClientX(e.currentTarget, touch.clientX));
  }

  return (
    <div className={`${styles.bentoCard} ${styles.span4} ${styles.row2}`}>
      <div className={styles.cardHead}>Cash flow (from Transactions)</div>
      <div className={styles.chartWrap}>
        {hovered && (
          <div
            className={styles.chartTooltip}
            style={{ left: `${Math.min(92, Math.max(8, (xFor(hovered.index) / VIEW_WIDTH) * 100))}%` }}
          >
            <div className={styles.chartTooltipDate}>{formatDate(hovered.date)}</div>
            <div className={styles.chartTooltipValue}>{formatGBP(hovered.cumulative)}</div>
          </div>
        )}
        <svg
          width="100%"
          height={VIEW_HEIGHT}
          viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={`Cumulative cash flow trend from ${formatGBP(values[0])} to ${formatGBP(values[values.length - 1])}`}
          onMouseMove={handleMove}
          onMouseLeave={() => setHoverX(null)}
          onTouchMove={handleTouchMove}
          onTouchEnd={() => setHoverX(null)}
        >
          <polyline
            points={coords}
            fill="none"
            stroke={CHART_COLORS.coral}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {hovered && (
            <>
              <line
                x1={xFor(hovered.index)}
                y1={0}
                x2={xFor(hovered.index)}
                y2={VIEW_HEIGHT}
                stroke="var(--border)"
                strokeWidth={1}
              />
              <circle cx={xFor(hovered.index)} cy={yFor(hovered.cumulative)} r={4} fill={CHART_COLORS.coral} />
            </>
          )}
        </svg>
      </div>
    </div>
  );
}

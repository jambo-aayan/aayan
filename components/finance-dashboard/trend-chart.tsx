import styles from "./dashboard.module.css";
import { CHART_COLORS } from "@/lib/finance/palette";
import { formatGBP } from "@/lib/finance/format";

const VIEW_WIDTH = 400;
const VIEW_HEIGHT = 120;

export function TrendChart({ points }: { points: { date: Date; cumulative: number }[] }) {
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

  const coords = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * VIEW_WIDTH;
      const y = VIEW_HEIGHT - ((p.cumulative - min) / range) * (VIEW_HEIGHT - 10) - 5;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <div className={`${styles.bentoCard} ${styles.span4} ${styles.row2}`}>
      <div className={styles.cardHead}>Cash flow (from Transactions)</div>
      <svg
        width="100%"
        height={VIEW_HEIGHT}
        viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Cumulative cash flow trend from ${formatGBP(values[0])} to ${formatGBP(values[values.length - 1])}`}
      >
        <polyline
          points={coords}
          fill="none"
          stroke={CHART_COLORS.coral}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

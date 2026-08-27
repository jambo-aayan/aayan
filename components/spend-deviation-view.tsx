import { TrendingUp } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { formatGBP } from "@/lib/finance/format";
import styles from "./spend-deviation-view.module.css";

type SpendDeviation = { current: number; baseline: number; diffAmount: number; diffPercent: number; callout: "more" | "less" | null };
type CategorySpendDeviation = SpendDeviation & { category: string };

function phrase(deviation: SpendDeviation): string {
  const direction = deviation.diffPercent >= 0 ? "more" : "less";
  return `${formatGBP(Math.abs(deviation.diffAmount))} (${Math.abs(Math.round(deviation.diffPercent))}%) ${direction} than usual`;
}

function tone(deviation: SpendDeviation): "danger" | "positive" | "muted" {
  if (deviation.callout === "more") return "danger";
  if (deviation.callout === "less") return "positive";
  return "muted";
}

/** Current spend vs. each category's own trailing-3-month baseline
 * (ADR-0012) — distinct from the this-month category breakdown and from
 * Statements' single-reference-point diffs (month-over-month, YoY). Only
 * categories with 3 full qualifying prior months appear here at all. */
export function SpendDeviationView({
  whole,
  categories,
}: {
  whole: SpendDeviation | null;
  categories: CategorySpendDeviation[];
}) {
  if (whole === null && categories.length === 0) {
    return <EmptyState icon={TrendingUp} message="Keep logging Transactions — a spending baseline needs 3 months of history." />;
  }

  const calledOut = categories.filter((c) => c.callout !== null);
  const rest = categories.filter((c) => c.callout === null);

  return (
    <div>
      {whole !== null && (
        <p className={`${styles.headline} ${styles[tone(whole)]}`}>You spent {phrase(whole)} this month.</p>
      )}
      {calledOut.length > 0 && (
        <ul className={styles.list}>
          {calledOut.map((c) => (
            <li key={c.category} className={`${styles.row} ${styles[tone(c)]}`}>
              <span className={styles.category}>{c.category}</span>
              <span className={styles.detail}>{phrase(c)}</span>
            </li>
          ))}
        </ul>
      )}
      {rest.length > 0 && (
        <details className={styles.rest}>
          <summary>{rest.length} more categor{rest.length === 1 ? "y" : "ies"} tracked, within usual range</summary>
          <ul className={styles.list}>
            {rest.map((c) => (
              <li key={c.category} className={styles.row}>
                <span className={styles.category}>{c.category}</span>
                <span className={styles.detail}>{formatGBP(c.current)} (usual {formatGBP(c.baseline)})</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

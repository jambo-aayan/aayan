import type { SplitMeanResult } from "@/lib/insights/split-mean";
import { CORRELATION_CAVEAT } from "@/lib/insights/correlations";
import styles from "./correlation-card.module.css";

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** A mean-split card, not a Pearson pair — "trained" is a boolean per day,
 * not a numeric series, so it can't share CorrelationCard's scatter/r
 * shape (#128, ADR-0011). Reuses correlation-card.module.css's card
 * styling to read as one family with the Pearson cards around it. */
export function TrainedVsMoodCard({ result }: { result: SplitMeanResult }) {
  if (!result.ready) return null;

  const delta = result.trueAvg - result.falseAvg;
  const strength = Math.abs(delta) >= 1 ? "strong" : Math.abs(delta) >= 0.5 ? "moderate" : "weak";
  const direction = delta >= 0 ? "higher" : "lower";

  return (
    <div className={`${styles.card} ${styles[strength]}`}>
      <div className={styles.head}>
        <span className={styles.badge}>Mean split</span>
        <span className={styles.n}>
          {result.trueDays} trained · {result.falseDays} not
        </span>
      </div>
      <p className={styles.claim}>
        Mood averages {Math.abs(round1(delta))} points {direction} on days you trained ({round1(result.trueAvg)}) than days you didn&apos;t (
        {round1(result.falseAvg)}).
      </p>
      <p className={styles.caveat}>{CORRELATION_CAVEAT}</p>
    </div>
  );
}

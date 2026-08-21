import type { MomentumSummary } from "@/lib/insights/data";
import styles from "./momentum-card.module.css";

function deltaLabel(delta: number): string {
  if (delta === 0) return "±0";
  return delta > 0 ? `+${delta}` : `${delta}`;
}

export function MomentumCard({ momentum }: { momentum: MomentumSummary }) {
  const deltaClass = momentum.delta > 0 ? styles.positive : momentum.delta < 0 ? styles.negative : styles.flat;

  return (
    <div className={styles.card}>
      <div className={styles.eyebrow}>Momentum</div>

      <div className={styles.scoreRow}>
        <span className={styles.score}>{momentum.score}</span>
        <span className={`${styles.delta} ${deltaClass}`}>{deltaLabel(momentum.delta)} vs previous 28 days</span>
      </div>

      <div className={styles.history} aria-hidden>
        {momentum.history.map((value, i) => {
          const isLast = i === momentum.history.length - 1;
          return (
            <span
              key={i}
              className={isLast ? styles.barLast : styles.bar}
              style={{ height: `${Math.max(8, value)}%`, opacity: isLast ? 1 : Math.max(0.12, value / 100) }}
            />
          );
        })}
      </div>

      <p className={styles.read}>{momentum.writtenRead}</p>

      <div className={styles.inputs}>
        <span className={styles.input}>
          Adherence <strong>{momentum.inputs.adherence}%</strong>
          <span className={styles.weight}>× {Math.round(momentum.weights.adherence * 100)}%</span>
        </span>
        <span className={styles.input}>
          Follow-through <strong>{momentum.inputs.followThrough}%</strong>
          <span className={styles.weight}>× {Math.round(momentum.weights.followThrough * 100)}%</span>
        </span>
        <span className={styles.input}>
          Surplus <strong>{momentum.inputs.surplusRate}%</strong>
          <span className={styles.weight}>× {Math.round(momentum.weights.surplusRate * 100)}%</span>
        </span>
      </div>
    </div>
  );
}

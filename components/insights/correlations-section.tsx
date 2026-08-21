import type { CorrelationResult } from "@/lib/insights/correlations";
import { CorrelationCard } from "./correlation-card";
import styles from "./correlations-section.module.css";

export function CorrelationsSection({ results }: { results: CorrelationResult[] }) {
  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <span className={styles.eyebrow}>What moves what</span>
        <span className={styles.caption}>observed relationships · not medical advice</span>
      </div>

      {results.length === 0 ? (
        <p className={styles.empty}>Not enough logging yet to surface a relationship — check back after a couple more weeks.</p>
      ) : (
        <div className={styles.grid}>
          {results.map((r) => (
            <CorrelationCard key={r.id} result={r} />
          ))}
        </div>
      )}
    </div>
  );
}

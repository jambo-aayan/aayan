import type { CorrelationResult } from "@/lib/insights/correlations";
import type { SplitMeanResult } from "@/lib/insights/split-mean";
import { CorrelationCard } from "./correlation-card";
import { TrainedVsMoodCard } from "./trained-vs-mood-card";
import styles from "./correlations-section.module.css";

export function CorrelationsSection({ results, trainedVsMood }: { results: CorrelationResult[]; trainedVsMood: SplitMeanResult | null }) {
  const hasTrainedVsMood = trainedVsMood !== null && trainedVsMood.ready;

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <span className={styles.eyebrow}>What moves what</span>
        <span className={styles.caption}>observed relationships · not medical advice</span>
      </div>

      {results.length === 0 && !hasTrainedVsMood ? (
        <p className={styles.empty}>Not enough logging yet to surface a relationship — check back after a couple more weeks.</p>
      ) : (
        <div className={styles.grid}>
          {results.map((r) => (
            <CorrelationCard key={r.id} result={r} />
          ))}
          {trainedVsMood && <TrainedVsMoodCard result={trainedVsMood} />}
        </div>
      )}
    </div>
  );
}

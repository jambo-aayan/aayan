import type { ReviewStat } from "@/lib/weekly-review/data";
import styles from "./step-numbers.module.css";

export function StepNumbers({ stats }: { stats: ReviewStat[] }) {
  return (
    <div className={styles.grid}>
      {stats.map((stat) => (
        <div key={stat.label} className={styles.card}>
          <span className={styles.label}>{stat.label}</span>
          <div className={styles.valueRow}>
            <span className={styles.value}>{stat.value}</span>
            <span className={styles.delta}>{stat.delta}</span>
          </div>
          <p className={styles.note}>{stat.note}</p>
        </div>
      ))}
    </div>
  );
}

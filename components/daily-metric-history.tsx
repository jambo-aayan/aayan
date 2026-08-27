import styles from "./daily-metric-history.module.css";

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * A plain, honest history list for one or more DailyLog-derived metrics —
 * no chart, no fabricated trend line, just the real logged values newest
 * first. An empty list renders a stated limit ("No entries yet"), never a
 * zeroed-out chart — see INTERACTIONS.md's honesty rules.
 */
export function DailyMetricHistory({
  entries,
  emptyMessage,
}: {
  entries: { date: Date; label: string }[];
  emptyMessage: string;
}) {
  if (entries.length === 0) {
    return <p className={styles.empty}>{emptyMessage}</p>;
  }

  return (
    <div className={styles.list}>
      {[...entries]
        .reverse()
        .slice(0, 14)
        .map((entry) => (
          <div key={entry.date.getTime()} className={styles.row}>
            <span className={styles.date}>{toDateString(entry.date)}</span>
            <span className={styles.value}>{entry.label}</span>
          </div>
        ))}
    </div>
  );
}

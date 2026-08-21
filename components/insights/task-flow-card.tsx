import type { TaskFlowSummary } from "@/lib/insights/task-flow";
import styles from "./task-flow-card.module.css";

function weekLabel(iso: string): string {
  const date = new Date(`${iso}T00:00:00.000Z`);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function TaskFlowCard({ flow }: { flow: TaskFlowSummary }) {
  const maxCount = Math.max(...flow.weeks.flatMap((w) => [w.created, w.closed]), 1);

  return (
    <div className={styles.card}>
      <div className={styles.eyebrow}>Task flow</div>

      <div className={styles.chart}>
        {flow.weeks.map((week) => (
          <div key={week.weekStart} className={styles.weekGroup}>
            <div className={styles.bars}>
              <span className={styles.createdBar} style={{ height: `${Math.max(2, (week.created / maxCount) * 100)}%` }} title={`Created: ${week.created}`} />
              <span className={styles.closedBar} style={{ height: `${Math.max(2, (week.closed / maxCount) * 100)}%` }} title={`Closed: ${week.closed}`} />
            </div>
            <span className={styles.weekLabel}>{weekLabel(week.weekStart)}</span>
          </div>
        ))}
      </div>

      <div className={styles.legend}>
        <span className={styles.legendItem}>
          <span className={`${styles.legendSwatch} ${styles.legendCreated}`} aria-hidden /> Created
        </span>
        <span className={styles.legendItem}>
          <span className={`${styles.legendSwatch} ${styles.legendClosed}`} aria-hidden /> Closed
        </span>
      </div>

      <div className={styles.footer}>
        <span className={styles.footerStat}>Carry-over rate: {flow.carryOverRate}%</span>
        <span className={styles.footerStat}>
          Median age of open tasks: {flow.medianOpenTaskAgeDays === null ? "—" : `${flow.medianOpenTaskAgeDays}d`}
        </span>
        <span className={styles.footerStat}>Closed on or before due: {flow.onTimeCloseRate}%</span>
      </div>
    </div>
  );
}

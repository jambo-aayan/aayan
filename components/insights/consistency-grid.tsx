import type { ConsistencyGridSummary } from "@/lib/insights/data";
import styles from "./consistency-grid.module.css";

export function ConsistencyGrid({ grid }: { grid: ConsistencyGridSummary }) {
  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <span className={styles.eyebrow}>Consistency</span>
        <span className={styles.legend}>
          <span className={`${styles.legendSwatch} ${styles.legendFull}`} aria-hidden /> filled = done
          <span className={`${styles.legendSwatch} ${styles.legendPartial}`} aria-hidden /> half = partial
        </span>
      </div>

      {grid.rows.length === 0 ? (
        <p className={styles.empty}>No active habits yet.</p>
      ) : (
        <div className={styles.rows}>
          {grid.rows.map((row) => {
            const color = row.color ?? "var(--ink)";
            return (
              <div key={row.habitId} className={styles.row}>
                <span className={styles.habitName} title={row.habitName}>
                  {row.habitName}
                </span>
                <div className={styles.cells} aria-hidden>
                  {row.cells.map((cell, i) => (
                    <span
                      key={grid.days[i]}
                      className={styles.cell}
                      style={{
                        background: cell === "none" ? "rgba(34, 30, 26, .055)" : color,
                        opacity: cell === "full" ? 0.85 : cell === "partial" ? 0.34 : 1,
                      }}
                      title={`${row.habitName} — ${grid.days[i]}: ${cell}`}
                    />
                  ))}
                </div>
                <span className={styles.pct}>{row.pct}%</span>
              </div>
            );
          })}
        </div>
      )}

      <div className={styles.footer}>
        <span className={styles.footerStat}>
          {grid.longestStreak ? `Longest streak: ${grid.longestStreak.habitName}, ${grid.longestStreak.days} days` : "No streaks yet"}
        </span>
        <span className={styles.footerStat}>{grid.habitsAbove60} habit{grid.habitsAbove60 === 1 ? "" : "s"} above 60%</span>
        <span className={styles.footerStat}>
          {grid.weakestWeekday ? `Weakest weekday: ${grid.weakestWeekday.label} (${grid.weakestWeekday.pct}%)` : "Not enough data yet"}
        </span>
      </div>
    </div>
  );
}

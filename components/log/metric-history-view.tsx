import { LineTrendChart } from "@/components/visuals/line-trend-chart";
import { EmptyState } from "@/components/empty-state";
import { metricHistoryPoints } from "@/lib/metrics/history";
import { History } from "lucide-react";
import styles from "./metric-history-view.module.css";

type Entry = { date: Date; numberValue: number | null; textValue: string | null };
type ValueType = "NUMBER" | "SCALE_5" | "BOOLEAN" | "ENUM" | "TEXT";

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * A Metric's full history (#185) — a trend chart for the numeric value
 * types (NUMBER/SCALE_5/BOOLEAN), reusing the same LineTrendChart every
 * other chart in the app plots through (per #181's own decision, "render
 * with the existing chart primitives"). TEXT/ENUM entries have no numeric
 * value to plot, so they get a plain reverse-chronological list instead —
 * a line chart over free text/choices wouldn't be a meaningful shape.
 */
export function MetricHistoryView({ entries, valueType, unit }: { entries: Entry[]; valueType: ValueType; unit: string | null }) {
  if (entries.length === 0) {
    return <EmptyState icon={History} message="No entries logged yet." />;
  }

  if (valueType === "TEXT" || valueType === "ENUM") {
    return (
      <ul className={styles.list}>
        {[...entries].reverse().map((entry, i) => (
          <li key={i} className={styles.row}>
            <span className={styles.date}>{formatDate(entry.date)}</span>
            <span className={styles.value}>{entry.textValue}</span>
          </li>
        ))}
      </ul>
    );
  }

  const points = metricHistoryPoints(entries);
  return (
    <div>
      <LineTrendChart points={points} height={200} color="var(--coral)" />
      {unit && <p className={styles.unitNote}>Values in {unit}</p>}
    </div>
  );
}

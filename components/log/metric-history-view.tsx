import { LineTrendChart } from "@/components/visuals/line-trend-chart";
import { EmptyState } from "@/components/empty-state";
import { metricHistoryPoints, type MetricEntryForHistory, type MetricCadence } from "@/lib/metrics/history";
import type { MetricValueType } from "@/lib/metrics/logic";
import { History } from "lucide-react";
import styles from "./metric-history-view.module.css";

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatBoolean(value: number | null): string {
  return value === 1 ? "Yes" : "No";
}

/**
 * A Metric's full history (#185) — a trend chart for the numeric value
 * types (NUMBER/SCALE_5/BOOLEAN), reusing the same LineTrendChart every
 * other chart in the app plots through (per #181's own decision, "render
 * with the existing chart primitives"). TEXT/ENUM entries have no numeric
 * value to plot, so they get a plain reverse-chronological list instead —
 * a line chart over free text/choices wouldn't be a meaningful shape.
 */
export function MetricHistoryView({
  entries,
  valueType,
  cadence,
  unit,
}: {
  entries: MetricEntryForHistory[];
  valueType: MetricValueType;
  cadence: MetricCadence;
  unit: string | null;
}) {
  if (entries.length === 0) {
    return <EmptyState icon={History} message="No entries logged yet." />;
  }

  if (valueType === "TEXT" || valueType === "ENUM") {
    return (
      <ul className={styles.list}>
        {[...entries].reverse().map((entry) => (
          <li key={entry.id} className={styles.row}>
            <span className={styles.date}>{formatDate(entry.date)}</span>
            <span className={styles.value}>{entry.textValue}</span>
          </li>
        ))}
      </ul>
    );
  }

  if (valueType === "BOOLEAN") {
    return (
      <ul className={styles.list}>
        {[...entries].reverse().map((entry) => (
          <li key={entry.id} className={styles.row}>
            <span className={styles.date}>{formatDate(entry.date)}</span>
            <span className={styles.value}>{formatBoolean(entry.numberValue)}</span>
          </li>
        ))}
      </ul>
    );
  }

  const points = metricHistoryPoints(entries, cadence);
  const first = points[0]?.value;
  const last = points[points.length - 1]?.value;
  return (
    <div role="img" aria-label={`Trend from ${first}${unit ? ` ${unit}` : ""} to ${last}${unit ? ` ${unit}` : ""} across ${points.length} entries`}>
      <LineTrendChart points={points} height={200} color="var(--coral)" />
      {unit && <p className={styles.unitNote}>Values in {unit}</p>}
    </div>
  );
}

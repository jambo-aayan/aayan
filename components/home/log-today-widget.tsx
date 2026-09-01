"use client";

import { useState } from "react";
import { LineChart as LineChartIcon } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { logTodayValue, type VisualWithRecords } from "@/lib/visuals/actions";
import { withRetry } from "@/lib/with-retry";
import { useToast } from "@/components/toast/toast-provider";
import { todayLocalDateString } from "@/lib/local-date";
import { valueForDate } from "@/lib/visuals/records";
import styles from "./log-today-widget.module.css";

export type LogTodayChart = {
  id: string;
  title: string;
  pillarId: string;
  areaId: string | null;
  pillar: { name: string };
  area: { name: string } | null;
  records: VisualWithRecords["records"];
};

function LogTodayRow({ chart, today }: { chart: LogTodayChart; today: string }) {
  const { notifyError } = useToast();
  const [value, setValue] = useState(() => {
    const existing = valueForDate(chart.records, today);
    return existing === null ? "" : String(existing);
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function commit() {
    if (value.trim() === "") return;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      setError("Enter a valid number.");
      return;
    }
    setSaving(true);
    setError(null);
    const result = await withRetry(() => logTodayValue(chart.id, chart.pillarId, chart.areaId, today, parsed));
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      notifyError(result.error, { onRetry: commit });
    }
  }

  return (
    <div className={styles.row}>
      <div className={styles.info}>
        <span className={styles.title}>{chart.title}</span>
        <span className={styles.context}>{chart.area ? `${chart.pillar.name} / ${chart.area.name}` : chart.pillar.name}</span>
      </div>
      <div className={styles.field}>
        <input
          type="number"
          className={styles.valueInput}
          placeholder="Value"
          value={value}
          disabled={saving}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
        />
        {error && <span className={styles.error}>{error}</span>}
      </div>
    </div>
  );
}

/** Home's "Log today" widget (#170, ADR-0017) — every ad-hoc, unbound
 * Line/Bar/Streak heatmap chart across all Pillars/Areas gets one compact
 * row here, so logging a metric doesn't need a trip to its own page
 * first. Each row's input pre-fills with today's already-logged value (if
 * any) via lib/visuals/records.ts's valueForDate, and commits on blur —
 * logTodayValue upserts, so re-entering a value the same day updates that
 * record instead of creating a duplicate. `today` is computed once here
 * (not per-row) so every row saves against the exact same date string. */
export function LogTodayWidget({ charts }: { charts: LogTodayChart[] }) {
  const today = todayLocalDateString();

  if (charts.length === 0) {
    return <EmptyState icon={LineChartIcon} message="No charts to log yet." />;
  }

  return (
    <div className={styles.list}>
      {charts.map((chart) => (
        <LogTodayRow key={chart.id} chart={chart} today={today} />
      ))}
    </div>
  );
}

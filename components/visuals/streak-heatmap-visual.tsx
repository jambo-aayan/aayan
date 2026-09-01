"use client";

import { createVisualRecord, createVisualRecordsBulk } from "@/lib/visuals/actions";
import { withRetry } from "@/lib/with-retry";
import { useToast } from "@/components/toast/toast-provider";
import { AddRecordForm } from "./add-record-form";
import { BulkAddForm } from "./bulk-add-form";
import { VisualCard } from "./visual-card";
import { heatmapIntensities } from "@/lib/visuals/records";
import { formatDateShort } from "@/lib/visuals/format";
import { parseChartBinding } from "@/lib/visuals/config";
import type { VisualWithRecords } from "@/lib/visuals/actions";
import cardStyles from "./visual-card.module.css";
import styles from "./streak-heatmap-visual.module.css";

/** Renders a Streak heatmap Visual (#164, ADR-0017) — a calendar-style
 * grid of shaded cells, one per record, min-max normalized by value
 * (lib/visuals/records.ts's heatmapIntensities) rather than a fixed
 * absolute scale. Same date+value AddRecordForm/BulkAddForm as Line/Bar. */
export function StreakHeatmapVisual({
  visual,
  onRemove,
  onRecordAdded,
  onRecordsAdded,
}: {
  visual: VisualWithRecords;
  onRemove: () => void;
  onRecordAdded: (record: VisualWithRecords["records"][number]) => void;
  onRecordsAdded: (records: VisualWithRecords["records"]) => void;
}) {
  const { notifyError } = useToast();

  async function handleAdd(date: string, value: number, note: string) {
    const result = await withRetry(() => createVisualRecord(visual.id, visual.pillarId, visual.areaId, date, value, note));
    if (!result.ok) {
      notifyError(result.error);
      return result;
    }
    onRecordAdded(result.record);
    return { ok: true };
  }

  async function handleBulkAdd(rows: { date: string; value: number; note?: string }[]) {
    const result = await withRetry(() => createVisualRecordsBulk(visual.id, visual.pillarId, visual.areaId, rows));
    if (!result.ok) {
      notifyError(result.error);
      return result;
    }
    onRecordsAdded(result.records);
    return { ok: true };
  }

  const cells = heatmapIntensities(visual.records);
  const bound = parseChartBinding(visual.config) !== null;

  return (
    <VisualCard title={visual.title} onRemove={onRemove}>
      {cells.length === 0 ? (
        <p className={cardStyles.empty}>No data yet.</p>
      ) : (
        <div className={styles.grid}>
          {cells.map((cell) => (
            <div
              key={cell.date.toISOString()}
              className={styles.cell}
              style={{ opacity: 0.15 + cell.intensity * 0.85 }}
              title={`${formatDateShort(cell.date)}: ${cell.value}`}
            />
          ))}
        </div>
      )}

      {bound ? (
        <p className={cardStyles.bound}>Synced from live data.</p>
      ) : (
        <>
          <AddRecordForm onAdd={handleAdd} />
          <BulkAddForm onAdd={handleBulkAdd} />
        </>
      )}
    </VisualCard>
  );
}

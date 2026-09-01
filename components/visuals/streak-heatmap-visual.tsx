"use client";

import { createVisualRecord } from "@/lib/visuals/actions";
import { withRetry } from "@/lib/with-retry";
import { useToast } from "@/components/toast/toast-provider";
import { AddRecordForm } from "./add-record-form";
import { VisualCard } from "./visual-card";
import { heatmapIntensities } from "@/lib/visuals/records";
import { formatDateShort } from "@/lib/visuals/format";
import type { VisualWithRecords } from "@/lib/visuals/actions";
import cardStyles from "./visual-card.module.css";
import styles from "./streak-heatmap-visual.module.css";

/** Renders a Streak heatmap Visual (#164, ADR-0017) — a calendar-style
 * grid of shaded cells, one per record, min-max normalized by value
 * (lib/visuals/records.ts's heatmapIntensities) rather than a fixed
 * absolute scale. Same date+value AddRecordForm as Line/Bar. */
export function StreakHeatmapVisual({
  visual,
  onRemove,
  onRecordAdded,
}: {
  visual: VisualWithRecords;
  onRemove: () => void;
  onRecordAdded: (record: VisualWithRecords["records"][number]) => void;
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

  const cells = heatmapIntensities(visual.records);

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

      <AddRecordForm onAdd={handleAdd} />
    </VisualCard>
  );
}

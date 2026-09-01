"use client";

import { createVisualRecord } from "@/lib/visuals/actions";
import { withRetry } from "@/lib/with-retry";
import { useToast } from "@/components/toast/toast-provider";
import { AddRecordForm } from "./add-record-form";
import { VisualCard } from "./visual-card";
import { latestValue } from "@/lib/visuals/records";
import { parseProgressBarConfig } from "@/lib/visuals/config";
import type { VisualWithRecords } from "@/lib/visuals/actions";
import cardStyles from "./visual-card.module.css";
import styles from "./progress-bar-visual.module.css";

/** Renders a Progress bar Visual (#164, ADR-0017) — reads only the latest
 * record's value as "current" (lib/visuals/records.ts's latestValue), set
 * against the ad-hoc target stored in config at creation time. Once #166
 * adds binding, a Goal-bound Progress bar reads its target from the Goal
 * itself instead — this component doesn't need to change for that, only
 * where its target number comes from. Still logs data via the same
 * date+value AddRecordForm every date-series chart type uses. */
export function ProgressBarVisual({
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

  const current = latestValue(visual.records);
  const config = parseProgressBarConfig(visual.config);
  const percent = config && current !== null ? Math.max(0, Math.min(100, (current / config.target) * 100)) : 0;

  return (
    <VisualCard title={visual.title} onRemove={onRemove}>
      {config ? (
        <>
          <div className={styles.track}>
            <div className={styles.fill} style={{ width: `${percent}%` }} />
          </div>
          <span className={styles.numbers}>
            {current ?? 0} / {config.target}
          </span>
        </>
      ) : (
        <p className={cardStyles.empty}>No target set.</p>
      )}

      <AddRecordForm onAdd={handleAdd} />
    </VisualCard>
  );
}

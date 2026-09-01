"use client";

import { createVisualRecord } from "@/lib/visuals/actions";
import { withRetry } from "@/lib/with-retry";
import { useToast } from "@/components/toast/toast-provider";
import { AddRecordForm } from "./add-record-form";
import { VisualCard } from "./visual-card";
import { latestValue } from "@/lib/visuals/records";
import { parseChartBinding, parseProgressBarConfig } from "@/lib/visuals/config";
import type { VisualWithRecords } from "@/lib/visuals/actions";
import cardStyles from "./visual-card.module.css";
import styles from "./progress-bar-visual.module.css";

/** Renders a Progress bar Visual (#164/#166, ADR-0017) — reads only the
 * latest record's value as "current" (lib/visuals/records.ts's
 * latestValue), set against a target. For an ad-hoc chart that target is
 * whatever was set at creation time; for a Goal-bound one,
 * resolve-binding.ts merges the Goal's own target into `config` at render
 * time, so parseProgressBarConfig reads it the same way either way —
 * only the data-entry form hides itself for a bound chart, via
 * parseChartBinding. */
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
  const bound = parseChartBinding(visual.config) !== null;

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

      {bound ? <p className={cardStyles.bound}>Synced from live data.</p> : <AddRecordForm onAdd={handleAdd} />}
    </VisualCard>
  );
}

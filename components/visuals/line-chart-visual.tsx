"use client";

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Trash2 } from "lucide-react";
import { createVisualRecord } from "@/lib/visuals/actions";
import { withRetry } from "@/lib/with-retry";
import { useToast } from "@/components/toast/toast-provider";
import { AddRecordForm } from "./add-record-form";
import { formatDateShort } from "@/lib/visuals/format";
import type { VisualWithRecords } from "@/lib/visuals/actions";
import styles from "./line-chart-visual.module.css";

/** Renders one Line chart Visual (#163, ADR-0017) — reads date+yValue from
 * its ad-hoc VisualRecords, ordered by date. Renders straight off the
 * `visual` prop rather than holding its own local records copy — the
 * parent ChartZone owns list state (via useUndoableCrudList) and needs an
 * up-to-date `records` array on hand for restoreVisual if this chart gets
 * deleted right after a record is added, so `onRecordAdded` reports each
 * new record up rather than this component tracking it privately. */
export function LineChartVisual({
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

  const points = visual.records
    .filter((r) => r.date !== null && r.yValue !== null)
    .map((r) => ({ label: formatDateShort(r.date!), value: r.yValue! }));

  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <span className={styles.title}>{visual.title}</span>
        <div className={styles.actions}>
          <button type="button" className={styles.iconButton} onClick={onRemove} aria-label={`Remove ${visual.title}`}>
            <Trash2 size={15} strokeWidth={2} />
          </button>
        </div>
      </div>

      {points.length === 0 ? (
        <p className={styles.empty}>No data yet.</p>
      ) : (
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={points}>
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} width={32} />
            <Tooltip />
            <Line type="monotone" dataKey="value" stroke="var(--coral)" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      )}

      <AddRecordForm onAdd={handleAdd} />
    </div>
  );
}

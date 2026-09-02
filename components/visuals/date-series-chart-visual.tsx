"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { createVisualRecord, createVisualRecordsBulk } from "@/lib/visuals/actions";
import { withRetry } from "@/lib/with-retry";
import { useToast } from "@/components/toast/toast-provider";
import { AddRecordForm } from "./add-record-form";
import { BulkAddForm } from "./bulk-add-form";
import { VisualCard } from "./visual-card";
import { LineTrendChart } from "./line-trend-chart";
import { formatDateShort } from "@/lib/visuals/format";
import { dateValuePoints } from "@/lib/visuals/records";
import { parseChartBinding } from "@/lib/visuals/config";
import type { VisualWithRecords } from "@/lib/visuals/actions";
import styles from "./visual-card.module.css";

/** Renders a Line or Bar chart Visual (#163/#164, ADR-0017) — both read
 * the exact same date+yValue shape off a Visual's ad-hoc VisualRecords
 * (lib/visuals/records.ts's dateValuePoints), differing only in which
 * Recharts component draws them — one component, not two near-duplicates.
 * Renders straight off the `visual` prop rather than holding its own local
 * records copy — the parent ChartZone owns list state (via
 * useUndoableCrudList) and needs an up-to-date `records` array on hand for
 * restoreVisual if this chart gets deleted right after a record is added,
 * so `onRecordAdded` reports each new record up rather than this
 * component tracking it privately. */
export function DateSeriesChartVisual({
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

  const points = dateValuePoints(visual.records).map((p) => ({ label: formatDateShort(p.date), value: p.value }));
  const bound = parseChartBinding(visual.config) !== null;

  return (
    <VisualCard title={visual.title} onRemove={onRemove}>
      {points.length === 0 ? (
        <p className={styles.empty}>No data yet.</p>
      ) : visual.type === "BAR" ? (
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={points}>
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} width={32} />
            <Tooltip />
            <Bar dataKey="value" fill="var(--coral)" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <LineTrendChart points={points} />
      )}

      {bound ? (
        <p className={styles.bound}>Synced from live data.</p>
      ) : (
        <>
          <AddRecordForm onAdd={handleAdd} />
          <BulkAddForm onAdd={handleBulkAdd} />
        </>
      )}
    </VisualCard>
  );
}

"use client";

import { ScatterChart, Scatter, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { createVisualXYRecord } from "@/lib/visuals/actions";
import { withRetry } from "@/lib/with-retry";
import { useToast } from "@/components/toast/toast-provider";
import { AddScatterRecordForm } from "./add-scatter-record-form";
import { VisualCard } from "./visual-card";
import { scatterPoints } from "@/lib/visuals/records";
import type { VisualWithRecords } from "@/lib/visuals/actions";
import styles from "./visual-card.module.css";

/** Renders a Scatter chart Visual (#164, ADR-0017) — ad-hoc only in this
 * ticket; independently-bindable X/Y axes are #167. Reads xValue+yValue
 * off its VisualRecords (lib/visuals/records.ts's scatterPoints), unlike
 * every other chart type's date+yValue shape. */
export function ScatterVisual({
  visual,
  onRemove,
  onRecordAdded,
}: {
  visual: VisualWithRecords;
  onRemove: () => void;
  onRecordAdded: (record: VisualWithRecords["records"][number]) => void;
}) {
  const { notifyError } = useToast();

  async function handleAdd(x: number, y: number, note: string) {
    const result = await withRetry(() => createVisualXYRecord(visual.id, visual.pillarId, visual.areaId, x, y, note));
    if (!result.ok) {
      notifyError(result.error);
      return result;
    }
    onRecordAdded(result.record);
    return { ok: true };
  }

  const points = scatterPoints(visual.records);

  return (
    <VisualCard title={visual.title} onRemove={onRemove}>
      {points.length === 0 ? (
        <p className={styles.empty}>No data yet.</p>
      ) : (
        <ResponsiveContainer width="100%" height={180}>
          <ScatterChart>
            <XAxis dataKey="x" type="number" tick={{ fontSize: 11 }} name="X" />
            <YAxis dataKey="y" type="number" tick={{ fontSize: 11 }} width={32} name="Y" />
            <Tooltip cursor={{ strokeDasharray: "3 3" }} />
            <Scatter data={points} fill="var(--coral)" />
          </ScatterChart>
        </ResponsiveContainer>
      )}

      <AddScatterRecordForm onAdd={handleAdd} />
    </VisualCard>
  );
}

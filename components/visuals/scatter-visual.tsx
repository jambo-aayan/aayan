"use client";

import { useRouter } from "next/navigation";
import { ScatterChart, Scatter, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { createVisualAxisRecord, createVisualXYRecord } from "@/lib/visuals/actions";
import { withRetry } from "@/lib/with-retry";
import { useToast } from "@/components/toast/toast-provider";
import { AddScatterRecordForm } from "./add-scatter-record-form";
import { AddScatterAxisForm } from "./add-scatter-axis-form";
import { VisualCard } from "./visual-card";
import { scatterPoints } from "@/lib/visuals/records";
import { parseScatterBinding } from "@/lib/visuals/config";
import type { VisualWithRecords } from "@/lib/visuals/actions";
import styles from "./visual-card.module.css";

/** Renders a Scatter chart Visual (#164/#167, ADR-0017). Reads xValue+
 * yValue off its VisualRecords (lib/visuals/records.ts's scatterPoints),
 * unlike every other chart type's date+yValue shape — true whether those
 * records are ad-hoc or (#167) resolve-binding.ts's synthetic
 * date/index-joined pairs from one or two bound sources. A mixed binding
 * (one axis bound, one still ad-hoc) is the one case here that can't just
 * merge a new point into local state the way every other chart's
 * onRecordAdded does — the new manual value needs pairing against the
 * bound series server-side, so it goes through router.refresh() instead
 * of an optimistic update, same "server computation re-runs" pattern as
 * SectionManager's own router.refresh(). */
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
  const router = useRouter();

  async function handleAdd(x: number, y: number, note: string) {
    const result = await withRetry(() => createVisualXYRecord(visual.id, visual.pillarId, visual.areaId, x, y, note));
    if (!result.ok) {
      notifyError(result.error);
      return result;
    }
    onRecordAdded(result.record);
    return { ok: true };
  }

  async function handleAddAxisValue(axis: "x" | "y", value: number, note: string) {
    const result = await withRetry(() => createVisualAxisRecord(visual.id, visual.pillarId, visual.areaId, axis, value, note));
    if (!result.ok) {
      notifyError(result.error);
      return result;
    }
    router.refresh();
    return { ok: true };
  }

  const points = scatterPoints(visual.records);
  const binding = parseScatterBinding(visual.config);
  const fullyBound = binding !== null && binding.x !== null && binding.y !== null;
  const manualAxis = binding !== null && binding.x === null ? "x" : binding !== null && binding.y === null ? "y" : null;

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

      {fullyBound ? (
        <p className={styles.bound}>Synced from live data.</p>
      ) : manualAxis ? (
        <>
          <p className={styles.bound}>{manualAxis === "x" ? "Y" : "X"} synced from live data.</p>
          <AddScatterAxisForm
            axisLabel={manualAxis.toUpperCase()}
            onAdd={(value, note) => handleAddAxisValue(manualAxis, value, note)}
          />
        </>
      ) : (
        <AddScatterRecordForm onAdd={handleAdd} />
      )}
    </VisualCard>
  );
}

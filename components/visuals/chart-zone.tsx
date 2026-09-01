"use client";

import { useState } from "react";
import { LineChart as LineChartIcon } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PrimaryButton } from "@/components/primary-button";
import { AddChartModal } from "./add-chart-modal";
import { DateSeriesChartVisual } from "./date-series-chart-visual";
import { ProgressBarVisual } from "./progress-bar-visual";
import { ScatterVisual } from "./scatter-visual";
import { StreakHeatmapVisual } from "./streak-heatmap-visual";
import { createVisual, deleteVisual, restoreVisual, type VisualWithRecords } from "@/lib/visuals/actions";
import { useUndoableCrudList } from "@/lib/hooks/use-undoable-crud-list";
import type { Prisma, VisualType } from "@/lib/generated/prisma/client";
import styles from "./chart-zone.module.css";

type CreateInput = { type: VisualType; title: string; config?: Prisma.InputJsonValue };

/** The Charts zone (#161-#164, ADR-0017) — holds any number of chart
 * Visuals on a Pillar/Area page, unlike the six singular sections it sits
 * alongside in the same section list. Reuses
 * lib/hooks/use-undoable-crud-list.ts for add/remove-with-undo (its
 * `update` is optional precisely so a caller with no edit UI, like this
 * one, doesn't need a fake no-op). Dispatches each Visual to the
 * component matching its type — Line/Bar share DateSeriesChartVisual
 * (same date+yValue record shape, differing only in which Recharts
 * component draws them). */
export function ChartZone({
  visuals,
  pillarId,
  areaId,
}: {
  visuals: VisualWithRecords[];
  pillarId: string;
  areaId: string | null;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const { items, setItems, undo, add, remove, undoDelete } = useUndoableCrudList<VisualWithRecords, CreateInput>(
    visuals,
    {
      create: async (input) => {
        const result = await createVisual(pillarId, areaId, input.type, input.title, input.config);
        return result.ok ? { ok: true, item: result.visual } : result;
      },
      remove: (id) => deleteVisual(pillarId, areaId, id),
      restore: (item) => restoreVisual(item),
    }
  );

  async function handleCreate(type: VisualType, title: string, config?: Prisma.InputJsonValue) {
    const ok = await add({ type, title, config });
    return { ok };
  }

  function handleRecordsAdded(visualId: string, newRecords: VisualWithRecords["records"]) {
    setItems((prev) =>
      prev.map((v) =>
        v.id === visualId
          ? {
              ...v,
              records: [...v.records, ...newRecords].sort((a, b) =>
                a.date && b.date ? a.date.getTime() - b.date.getTime() : 0
              ),
            }
          : v
      )
    );
  }

  return (
    <div className={styles.list}>
      {items.length === 0 && <EmptyState icon={LineChartIcon} message="No charts yet." />}
      {items.map((visual) => {
        const onRemove = () => remove(visual);
        const onRecordAdded = (record: VisualWithRecords["records"][number]) => handleRecordsAdded(visual.id, [record]);
        switch (visual.type) {
          case "LINE":
          case "BAR":
            return (
              <DateSeriesChartVisual
                key={visual.id}
                visual={visual}
                onRemove={onRemove}
                onRecordAdded={onRecordAdded}
                onRecordsAdded={(records) => handleRecordsAdded(visual.id, records)}
              />
            );
          case "PROGRESS_BAR":
            return <ProgressBarVisual key={visual.id} visual={visual} onRemove={onRemove} onRecordAdded={onRecordAdded} />;
          case "SCATTER":
            return <ScatterVisual key={visual.id} visual={visual} onRemove={onRemove} onRecordAdded={onRecordAdded} />;
          case "STREAK_HEATMAP":
            return (
              <StreakHeatmapVisual
                key={visual.id}
                visual={visual}
                onRemove={onRemove}
                onRecordAdded={onRecordAdded}
                onRecordsAdded={(records) => handleRecordsAdded(visual.id, records)}
              />
            );
          default:
            return null;
        }
      })}
      <PrimaryButton className={styles.addTrigger} onClick={() => setModalOpen(true)}>
        + Add chart
      </PrimaryButton>
      {undo && (
        <div className={styles.undoToast}>
          <span>Removed &ldquo;{undo.title}&rdquo;.</span>
          <button type="button" className={styles.undoBtn} onClick={undoDelete}>
            Undo
          </button>
        </div>
      )}
      {modalOpen && (
        <AddChartModal pillarId={pillarId} areaId={areaId} onClose={() => setModalOpen(false)} onCreate={handleCreate} />
      )}
    </div>
  );
}

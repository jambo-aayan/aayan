"use client";

import { useState } from "react";
import { LineChart as LineChartIcon } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PrimaryButton } from "@/components/primary-button";
import { AddChartModal } from "./add-chart-modal";
import { LineChartVisual } from "./line-chart-visual";
import { createVisual, deleteVisual, restoreVisual, type VisualWithRecords } from "@/lib/visuals/actions";
import { useUndoableCrudList } from "@/lib/hooks/use-undoable-crud-list";
import type { VisualType } from "@/lib/generated/prisma/client";
import styles from "./chart-zone.module.css";

type CreateInput = { type: VisualType; title: string };

/** The Charts zone (#161-#163, ADR-0017) — holds any number of chart
 * Visuals on a Pillar/Area page, unlike the six singular sections it sits
 * alongside in the same section list. Reuses
 * lib/hooks/use-undoable-crud-list.ts for add/remove-with-undo (its
 * `update` is optional precisely so a caller with no edit UI, like this
 * one, doesn't need a fake no-op). Only LINE is creatable as of #163;
 * #164 adds the rest. */
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
        const result = await createVisual(pillarId, areaId, input.type, input.title);
        return result.ok ? { ok: true, item: result.visual } : result;
      },
      remove: (id) => deleteVisual(pillarId, areaId, id),
      restore: (item) => restoreVisual(item),
    }
  );

  async function handleCreate(type: VisualType, title: string) {
    const ok = await add({ type, title });
    return { ok };
  }

  function handleRecordAdded(visualId: string, record: VisualWithRecords["records"][number]) {
    setItems((prev) =>
      prev.map((v) =>
        v.id === visualId
          ? {
              ...v,
              records: [...v.records, record].sort((a, b) => (a.date && b.date ? a.date.getTime() - b.date.getTime() : 0)),
            }
          : v
      )
    );
  }

  return (
    <div className={styles.list}>
      {items.length === 0 && <EmptyState icon={LineChartIcon} message="No charts yet." />}
      {items.map((visual) =>
        visual.type === "LINE" ? (
          <LineChartVisual
            key={visual.id}
            visual={visual}
            onRemove={() => remove(visual)}
            onRecordAdded={(record) => handleRecordAdded(visual.id, record)}
          />
        ) : null
      )}
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
      {modalOpen && <AddChartModal onClose={() => setModalOpen(false)} onCreate={handleCreate} />}
    </div>
  );
}

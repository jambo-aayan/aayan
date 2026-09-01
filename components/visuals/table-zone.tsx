"use client";

import { useState } from "react";
import { Table2 } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PrimaryButton } from "@/components/primary-button";
import { TableVisual } from "./table-visual";
import { createVisual, deleteVisual, restoreVisual, type VisualWithRecords } from "@/lib/visuals/actions";
import { useUndoableCrudList } from "@/lib/hooks/use-undoable-crud-list";
import styles from "./table-zone.module.css";

/** The Table zone (#161/#162/#168, ADR-0017) — holds any number of
 * freeform Table Visuals on a Pillar/Area page, mirroring ChartZone's own
 * add/remove-with-undo shape via the same useUndoableCrudList. Unlike
 * AddChartModal, there's no gallery/title step here — a Table is the only
 * "type" in this v1, so "+ Add table" creates one immediately, titled
 * "Untitled table" (nothing to rename it to yet). */
export function TableZone({
  visuals,
  pillarId,
  areaId,
}: {
  visuals: VisualWithRecords[];
  pillarId: string;
  areaId: string | null;
}) {
  const [adding, setAdding] = useState(false);
  const { items, undo, add, remove, undoDelete } = useUndoableCrudList<VisualWithRecords, Record<string, never>>(
    visuals,
    {
      create: async () => {
        const result = await createVisual(pillarId, areaId, "TABLE", "Untitled table", {});
        return result.ok ? { ok: true, item: result.visual } : result;
      },
      remove: (id) => deleteVisual(pillarId, areaId, id),
      restore: (item) => restoreVisual(item),
    }
  );

  async function handleAdd() {
    setAdding(true);
    await add({});
    setAdding(false);
  }

  return (
    <div className={styles.list}>
      {items.length === 0 && <EmptyState icon={Table2} message="No tables yet." />}
      {items.map((visual) => (
        <TableVisual key={visual.id} visual={visual} pillarId={pillarId} areaId={areaId} onRemove={() => remove(visual)} />
      ))}
      <PrimaryButton className={styles.addTrigger} onClick={handleAdd} disabled={adding}>
        {adding ? "Adding…" : "+ Add table"}
      </PrimaryButton>
      {undo && (
        <div className={styles.undoToast}>
          <span>Removed &ldquo;{undo.title}&rdquo;.</span>
          <button type="button" className={styles.undoBtn} onClick={undoDelete}>
            Undo
          </button>
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Table2 } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PrimaryButton } from "@/components/primary-button";
import { TableVisual } from "./table-visual";
import { AddTableModal } from "./add-table-modal";
import { createVisual, deleteVisual, restoreVisual, type VisualWithRecords } from "@/lib/visuals/actions";
import { useUndoableCrudList } from "@/lib/hooks/use-undoable-crud-list";
import { parseTableBinding, type TableAdapterKind } from "@/lib/visuals/config";
import type { Prisma } from "@/lib/generated/prisma/client";
import styles from "./table-zone.module.css";

const ADAPTER_TITLES: Record<TableAdapterKind, string> = {
  goals: "Goals",
  habits: "Habits",
  tasks: "Tasks",
  systems: "Systems",
};

/** A bound table's rows/columns are server-computed from live entities
 * (lib/visuals/resolve-table-binding.ts), so TableVisual needs to
 * remount — not just re-render — whenever that resolved data actually
 * changes, to pick up the fresh `visual` prop without an effect fighting
 * React's "don't setState from a prop in an effect" guidance (see
 * table-visual.tsx's own doc comment). Keying by a fingerprint of the
 * rows/columns achieves that; a freeform table's data only ever changes
 * through its own component's actions, so it stays keyed by the stable
 * `visual.id` alone. */
function tableVisualKey(visual: VisualWithRecords): string {
  if (!parseTableBinding(visual.config)) return visual.id;
  const rowsFingerprint = visual.rows.map((r) => `${r.id}:${JSON.stringify(r.data)}`).join("|");
  const columnsFingerprint = visual.columns.map((c) => c.id).join(",");
  return `${visual.id}:${rowsFingerprint}:${columnsFingerprint}`;
}

/** The Table zone (#161/#162/#168/#169, ADR-0017) — holds any number of
 * Table Visuals on a Pillar/Area page, mirroring ChartZone's own
 * add/remove-with-undo shape via the same useUndoableCrudList. "+ Add
 * table" opens AddTableModal to pick freeform or one of the four bound
 * sources — much shorter than AddChartModal since a bound table has no
 * entity to pick (it binds to the whole live list) and nothing here needs
 * its own title input, so the adapter's own name (or "Untitled table" for
 * freeform) is title enough. */
export function TableZone({
  visuals,
  pillarId,
  areaId,
}: {
  visuals: VisualWithRecords[];
  pillarId: string;
  areaId: string | null;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const { items, setItems, undo, add, remove, undoDelete } = useUndoableCrudList<
    VisualWithRecords,
    { title: string; config?: Prisma.InputJsonValue }
  >(visuals, {
    create: async (input) => {
      const result = await createVisual(pillarId, areaId, "TABLE", input.title, input.config);
      return result.ok ? { ok: true, item: result.visual } : result;
    },
    remove: (id) => deleteVisual(pillarId, areaId, id),
    restore: (item) => restoreVisual(item),
  });

  // Same reasoning as chart-zone.tsx's own sync — a bound table's rows
  // are a live view resolve-table-binding.ts recomputes on every server
  // fetch, so this already-mounted list needs to pick up a fresh
  // `visuals` prop (an entity added/removed elsewhere, or a page
  // revalidation) rather than staying pinned to its mount-time snapshot.
  useEffect(() => {
    setItems(visuals);
  }, [visuals, setItems]);

  async function handleCreate(adapter: TableAdapterKind | null) {
    const title = adapter ? ADAPTER_TITLES[adapter] : "Untitled table";
    const config = adapter ? { tableBinding: { adapter } } : undefined;
    const ok = await add({ title, config });
    return { ok };
  }

  return (
    <div className={styles.list}>
      {items.length === 0 && <EmptyState icon={Table2} message="No tables yet." />}
      {items.map((visual) => (
        <TableVisual
          key={tableVisualKey(visual)}
          visual={visual}
          pillarId={pillarId}
          areaId={areaId}
          onRemove={() => remove(visual)}
        />
      ))}
      <PrimaryButton className={styles.addTrigger} onClick={() => setModalOpen(true)}>
        + Add table
      </PrimaryButton>
      {undo && (
        <div className={styles.undoToast}>
          <span>Removed &ldquo;{undo.title}&rdquo;.</span>
          <button type="button" className={styles.undoBtn} onClick={undoDelete}>
            Undo
          </button>
        </div>
      )}
      {modalOpen && <AddTableModal onClose={() => setModalOpen(false)} onCreate={handleCreate} />}
    </div>
  );
}

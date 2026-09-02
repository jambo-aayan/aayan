"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { useDialogFocusTrap } from "@/components/use-dialog-focus-trap";
import type { TableAdapterKind } from "@/lib/visuals/config";
import styles from "./add-chart-modal.module.css";

const BOUND_OPTIONS: { adapter: TableAdapterKind; label: string }[] = [
  { adapter: "goals", label: "Goals" },
  { adapter: "habits", label: "Habits" },
  { adapter: "tasks", label: "Tasks" },
  { adapter: "systems", label: "Systems" },
  { adapter: "category-spend", label: "Spending categories" },
];

/** The add-table flow (#168/#169, ADR-0017) — much shorter than
 * AddChartModal's: a Table has no gallery of types and, when bound, binds
 * to a whole live entity list rather than one specific entity, so there's
 * no title step or entity picker here at all — picking a source creates
 * the table immediately. Reuses add-chart-modal.module.css's sheet/list
 * styling rather than duplicating it for a second near-identical modal. */
export function AddTableModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (adapter: TableAdapterKind | null) => Promise<{ ok: boolean; error?: string }>;
}) {
  const sheetRef = useRef<HTMLDivElement>(null);
  useDialogFocusTrap(sheetRef);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  async function handlePick(adapter: TableAdapterKind | null) {
    const result = await onCreate(adapter);
    if (result.ok) onClose();
  }

  return (
    <>
      <div className={styles.overlay} onClick={onClose} aria-hidden />
      <div ref={sheetRef} className={styles.sheet} role="dialog" aria-modal="true" aria-label="New table" tabIndex={-1}>
        <div className={styles.header}>
          <h2 className={styles.heading}>New table</h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        <div className={styles.body}>
          <div className={styles.sourceChoice}>
            <button type="button" className={styles.sourceOption} onClick={() => handlePick(null)}>
              Freeform
            </button>
            {BOUND_OPTIONS.map((o) => (
              <button key={o.adapter} type="button" className={styles.sourceOption} onClick={() => handlePick(o.adapter)}>
                Bind to {o.label}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.footer}>
          <button type="button" className={styles.cancelBtn} onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </>
  );
}

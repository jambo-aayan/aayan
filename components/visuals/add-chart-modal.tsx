"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { PrimaryButton } from "@/components/primary-button";
import { useDialogFocusTrap } from "@/components/use-dialog-focus-trap";
import { LineChartIcon, BarChartIcon, ProgressBarIcon, ScatterIcon, StreakHeatmapIcon } from "./chart-type-icons";
import type { VisualType } from "@/lib/generated/prisma/client";
import styles from "./add-chart-modal.module.css";

const CHART_TYPES: { type: VisualType; label: string; Icon: React.ComponentType; enabled: boolean }[] = [
  { type: "LINE", label: "Line", Icon: LineChartIcon, enabled: true },
  { type: "BAR", label: "Bar", Icon: BarChartIcon, enabled: false },
  { type: "PROGRESS_BAR", label: "Progress bar", Icon: ProgressBarIcon, enabled: false },
  { type: "SCATTER", label: "Scatter", Icon: ScatterIcon, enabled: false },
  { type: "STREAK_HEATMAP", label: "Streak heatmap", Icon: StreakHeatmapIcon, enabled: false },
];

/** The add-chart flow (#163, ADR-0017) — a modal, not an inline expansion
 * like NewAreaTile, since a multi-step type-gallery-then-details flow
 * needs more room than a section-list trigger has. Step 1 (gallery) only
 * lets Line through in this ticket; #164 enables the other four. Only
 * ad-hoc creation exists here — "bind to existing data" is #166. */
export function AddChartModal({ onClose, onCreate }: { onClose: () => void; onCreate: (type: VisualType, title: string) => Promise<{ ok: boolean; error?: string }> }) {
  const [type, setType] = useState<VisualType | null>(null);
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  useDialogFocusTrap(sheetRef);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  async function handleCreate() {
    if (!type) return;
    if (!title.trim()) {
      setError("Give it a title first.");
      return;
    }
    setSaving(true);
    setError(null);
    const result = await onCreate(type, title);
    setSaving(false);
    if (!result.ok) {
      setError(result.error ?? "Couldn't save — try again.");
      return;
    }
    onClose();
  }

  return (
    <>
      <div className={styles.overlay} onClick={onClose} aria-hidden />
      <div ref={sheetRef} className={styles.sheet} role="dialog" aria-modal="true" aria-label="New chart" tabIndex={-1}>
        <div className={styles.header}>
          <h2 className={styles.heading}>{type ? "New chart" : "Choose a chart type"}</h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        <div className={styles.body}>
          {!type && (
            <div className={styles.gallery}>
              {CHART_TYPES.map(({ type: t, label, Icon, enabled }) => (
                <button key={t} type="button" className={styles.galleryItem} disabled={!enabled} onClick={() => setType(t)}>
                  <Icon />
                  {label}
                </button>
              ))}
            </div>
          )}

          {type && (
            <div className={styles.field}>
              <label className={styles.label} htmlFor="chart-title">
                Title
              </label>
              <input
                id="chart-title"
                type="text"
                className={styles.textInput}
                value={title}
                autoFocus
                disabled={saving}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
            </div>
          )}

          {error && <p className={styles.error}>{error}</p>}
        </div>

        <div className={styles.footer}>
          <button
            type="button"
            className={styles.cancelBtn}
            onClick={type ? () => setType(null) : onClose}
            disabled={saving}
          >
            {type ? "Back" : "Cancel"}
          </button>
          {type && (
            <PrimaryButton onClick={handleCreate} disabled={saving}>
              {saving ? "Creating…" : "Create chart"}
            </PrimaryButton>
          )}
        </div>
      </div>
    </>
  );
}

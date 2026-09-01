"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { PrimaryButton } from "@/components/primary-button";
import { useDialogFocusTrap } from "@/components/use-dialog-focus-trap";
import { LineChartIcon, BarChartIcon, ProgressBarIcon, ScatterIcon, StreakHeatmapIcon } from "./chart-type-icons";
import type { VisualType } from "@/lib/generated/prisma/client";
import styles from "./add-chart-modal.module.css";

const CHART_TYPES: { type: VisualType; label: string; Icon: React.ComponentType }[] = [
  { type: "LINE", label: "Line", Icon: LineChartIcon },
  { type: "BAR", label: "Bar", Icon: BarChartIcon },
  { type: "PROGRESS_BAR", label: "Progress bar", Icon: ProgressBarIcon },
  { type: "SCATTER", label: "Scatter", Icon: ScatterIcon },
  { type: "STREAK_HEATMAP", label: "Streak heatmap", Icon: StreakHeatmapIcon },
];

/** The add-chart flow (#163/#164, ADR-0017) — a modal, not an inline
 * expansion like NewAreaTile, since a multi-step type-gallery-then-details
 * flow needs more room than a section-list trigger has. Only ad-hoc
 * creation exists here — "bind to existing data" is #166. Progress bar
 * needs a target set at creation time (#164) since there's nothing else
 * to derive "current vs. target" from until it's bound to a Goal. */
export function AddChartModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (type: VisualType, title: string, config?: { target: number }) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [type, setType] = useState<VisualType | null>(null);
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState("");
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
    let config: { target: number } | undefined;
    if (type === "PROGRESS_BAR") {
      const parsedTarget = Number(target);
      // Zero rejected too, not just NaN — a zero target makes "current /
      // target" undefined (0/0) once any data is logged.
      if (target.trim() === "" || Number.isNaN(parsedTarget) || parsedTarget <= 0) {
        setError("Enter a target greater than zero.");
        return;
      }
      config = { target: parsedTarget };
    }
    setSaving(true);
    setError(null);
    const result = await onCreate(type, title, config);
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
              {CHART_TYPES.map(({ type: t, label, Icon }) => (
                <button key={t} type="button" className={styles.galleryItem} onClick={() => setType(t)}>
                  <Icon />
                  {label}
                </button>
              ))}
            </div>
          )}

          {type && (
            <>
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
              {type === "PROGRESS_BAR" && (
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="chart-target">
                    Target
                  </label>
                  <input
                    id="chart-target"
                    type="number"
                    className={styles.textInput}
                    value={target}
                    disabled={saving}
                    onChange={(e) => setTarget(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  />
                </div>
              )}
            </>
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

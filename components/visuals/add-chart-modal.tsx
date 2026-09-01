"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { PrimaryButton } from "@/components/primary-button";
import { useDialogFocusTrap } from "@/components/use-dialog-focus-trap";
import { LineChartIcon, BarChartIcon, ProgressBarIcon, ScatterIcon, StreakHeatmapIcon } from "./chart-type-icons";
import { getAdapterOptions, type AdapterOption } from "@/lib/visuals/actions";
import type { ChartAdapterKind } from "@/lib/visuals/config";
import type { Prisma, VisualType } from "@/lib/generated/prisma/client";
import styles from "./add-chart-modal.module.css";

const CHART_TYPES: { type: VisualType; label: string; Icon: React.ComponentType }[] = [
  { type: "LINE", label: "Line", Icon: LineChartIcon },
  { type: "BAR", label: "Bar", Icon: BarChartIcon },
  { type: "PROGRESS_BAR", label: "Progress bar", Icon: ProgressBarIcon },
  { type: "SCATTER", label: "Scatter", Icon: ScatterIcon },
  { type: "STREAK_HEATMAP", label: "Streak heatmap", Icon: StreakHeatmapIcon },
];

const ADAPTER_LABELS: Record<ChartAdapterKind, string> = {
  "habit-checkins": "A Habit",
  "system-evaluations": "A System",
  "goal-progress": "A Goal",
  "finance-balances": "An Account",
};

const ALL_ADAPTERS: ChartAdapterKind[] = ["habit-checkins", "system-evaluations", "goal-progress", "finance-balances"];
// A bound Progress bar's target has to come from somewhere with a natural
// target — only Goal has one, so that's the only source it offers.
const PROGRESS_BAR_ADAPTERS: ChartAdapterKind[] = ["goal-progress"];

type Source = "adhoc" | "bound";

/** The add-chart flow (#163/#164/#166/#167, ADR-0017) — a modal, not an
 * inline expansion like NewAreaTile, since a multi-step
 * type-gallery-then-details flow needs more room than a section-list
 * trigger has. Every type gains a "use existing data" branch: pick a
 * source, pick which entity, done — no title-step target field for a
 * bound Progress bar, since #166 reads that from the bound Goal at render
 * time instead. Scatter is the one exception with two independent picks
 * instead of one — `adapter`/`refId` hold its X axis, `yAdapter`/`yRefId`
 * its Y axis, since #167 gave it two independently bindable sources
 * rather than the single `binding` every other bound chart type stores.
 * Either axis can also be left ad-hoc while the other binds
 * (`xSkipped`/`ySkipped`) — ADR-0017's "separately ad-hoc or bound"
 * design for Scatter, not just "both bound or neither." */
export function AddChartModal({
  pillarId,
  areaId,
  onClose,
  onCreate,
}: {
  pillarId: string;
  areaId: string | null;
  onClose: () => void;
  onCreate: (type: VisualType, title: string, config?: Prisma.InputJsonValue) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [type, setType] = useState<VisualType | null>(null);
  const [source, setSource] = useState<Source | null>(null);
  const [adapter, setAdapter] = useState<ChartAdapterKind | null>(null);
  const [refId, setRefId] = useState<string | null>(null);
  const [options, setOptions] = useState<AdapterOption[] | null>(null);
  const [xSkipped, setXSkipped] = useState(false);
  const [yAdapter, setYAdapter] = useState<ChartAdapterKind | null>(null);
  const [yRefId, setYRefId] = useState<string | null>(null);
  const [yOptions, setYOptions] = useState<AdapterOption[] | null>(null);
  const [ySkipped, setYSkipped] = useState(false);
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  useDialogFocusTrap(sheetRef);

  const isScatter = type === "SCATTER";
  const xResolved = refId !== null || xSkipped;
  const yResolved = yRefId !== null || ySkipped;
  const showDetails =
    type !== null &&
    (source === "adhoc" ||
      (source === "bound" && !isScatter && refId !== null) ||
      (source === "bound" && isScatter && xResolved && yResolved));
  // options/yOptions reset to null whenever their adapter changes (see the
  // effects below and handleBack), so "adapter chosen, no options yet" is
  // exactly the loading window — no separate boolean to keep in sync.
  const loadingOptions = adapter !== null && options === null;
  const loadingYOptions = yAdapter !== null && yOptions === null;

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  useEffect(() => {
    if (!adapter) return;
    let cancelled = false;
    getAdapterOptions(adapter, pillarId, areaId).then((opts) => {
      if (!cancelled) setOptions(opts);
    });
    return () => {
      cancelled = true;
    };
  }, [adapter, pillarId, areaId]);

  useEffect(() => {
    if (!yAdapter) return;
    let cancelled = false;
    getAdapterOptions(yAdapter, pillarId, areaId).then((opts) => {
      if (!cancelled) setYOptions(opts);
    });
    return () => {
      cancelled = true;
    };
  }, [yAdapter, pillarId, areaId]);

  function chooseBound() {
    setSource("bound");
    // Progress bar has exactly one bindable source, so skip straight to
    // its entity picker rather than showing a one-item source list.
    if (type === "PROGRESS_BAR") setAdapter(PROGRESS_BAR_ADAPTERS[0]);
  }

  function handleBack() {
    if (isScatter && yResolved) {
      setYRefId(null);
      setYSkipped(false);
      return;
    }
    if (isScatter && yAdapter) {
      setYAdapter(null);
      setYOptions(null);
      return;
    }
    if (xResolved) {
      setRefId(null);
      setXSkipped(false);
      return;
    }
    if (adapter) {
      setAdapter(null);
      setOptions(null);
      if (type === "PROGRESS_BAR") setSource(null);
      return;
    }
    if (source) {
      setSource(null);
      return;
    }
    setType(null);
  }

  async function handleCreate() {
    if (!type) return;
    if (!title.trim()) {
      setError("Give it a title first.");
      return;
    }
    let config: Prisma.InputJsonValue | undefined;
    if (source === "bound" && isScatter) {
      config = {
        ...(!xSkipped && adapter && refId ? { xBinding: { adapter, refId } } : {}),
        ...(!ySkipped && yAdapter && yRefId ? { yBinding: { adapter: yAdapter, refId: yRefId } } : {}),
      };
    } else if (source === "bound" && adapter && refId) {
      config = { binding: { adapter, refId } };
    } else if (type === "PROGRESS_BAR") {
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

          {type && !source && (
            <div className={styles.sourceChoice}>
              <button type="button" className={styles.sourceOption} onClick={() => setSource("adhoc")}>
                Enter my own data
              </button>
              <button type="button" className={styles.sourceOption} onClick={chooseBound}>
                Use existing data
              </button>
            </div>
          )}

          {source === "bound" && !adapter && !xSkipped && type !== "PROGRESS_BAR" && (
            <div className={styles.sourceChoice}>
              {isScatter && <p className={styles.hint}>X axis source</p>}
              {ALL_ADAPTERS.map((a) => (
                <button key={a} type="button" className={styles.sourceOption} onClick={() => setAdapter(a)}>
                  {ADAPTER_LABELS[a]}
                </button>
              ))}
              {isScatter && (
                <button type="button" className={styles.sourceOption} onClick={() => setXSkipped(true)}>
                  Skip — I&rsquo;ll enter X manually
                </button>
              )}
            </div>
          )}

          {source === "bound" && adapter && !refId && (
            <div className={styles.sourceChoice}>
              {isScatter && <p className={styles.hint}>X axis: {ADAPTER_LABELS[adapter]}</p>}
              {loadingOptions && <p className={styles.hint}>Loading…</p>}
              {!loadingOptions && options?.length === 0 && <p className={styles.hint}>Nothing to bind to yet.</p>}
              {!loadingOptions &&
                options?.map((o) => (
                  <button key={o.id} type="button" className={styles.sourceOption} onClick={() => setRefId(o.id)}>
                    {o.name}
                  </button>
                ))}
            </div>
          )}

          {source === "bound" && isScatter && xResolved && !yAdapter && !ySkipped && (
            <div className={styles.sourceChoice}>
              <p className={styles.hint}>Y axis source</p>
              {ALL_ADAPTERS.map((a) => (
                <button key={a} type="button" className={styles.sourceOption} onClick={() => setYAdapter(a)}>
                  {ADAPTER_LABELS[a]}
                </button>
              ))}
              <button type="button" className={styles.sourceOption} onClick={() => setYSkipped(true)}>
                Skip — I&rsquo;ll enter Y manually
              </button>
            </div>
          )}

          {source === "bound" && isScatter && xResolved && yAdapter && !yRefId && (
            <div className={styles.sourceChoice}>
              <p className={styles.hint}>Y axis: {ADAPTER_LABELS[yAdapter]}</p>
              {loadingYOptions && <p className={styles.hint}>Loading…</p>}
              {!loadingYOptions && yOptions?.length === 0 && <p className={styles.hint}>Nothing to bind to yet.</p>}
              {!loadingYOptions &&
                yOptions?.map((o) => (
                  <button key={o.id} type="button" className={styles.sourceOption} onClick={() => setYRefId(o.id)}>
                    {o.name}
                  </button>
                ))}
            </div>
          )}

          {showDetails && (
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
              {type === "PROGRESS_BAR" && source !== "bound" && (
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
          <button type="button" className={styles.cancelBtn} onClick={type ? handleBack : onClose} disabled={saving}>
            {type ? "Back" : "Cancel"}
          </button>
          {showDetails && (
            <PrimaryButton onClick={handleCreate} disabled={saving}>
              {saving ? "Creating…" : "Create chart"}
            </PrimaryButton>
          )}
        </div>
      </div>
    </>
  );
}

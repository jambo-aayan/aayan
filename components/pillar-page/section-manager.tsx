"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GripVertical, ChevronUp, ChevronDown, SlidersHorizontal } from "lucide-react";
import { updateAreaSectionConfig, updatePillarSectionConfig } from "@/lib/pillar-page/actions";
import { SECTION_LABELS, type SectionConfigEntry, type SectionType } from "@/lib/pillar-page/sections";
import { useToast } from "@/components/toast/toast-provider";
import { withRetry } from "@/lib/with-retry";
import styles from "./section-manager.module.css";

/** Lets the user reorder and toggle which sections show on a Pillar/Area
 * page (#160/ADR-0016) — same drag+chevron-buttons pattern as
 * components/weekly-review/step-rerank.tsx, plus a visibility checkbox
 * per row. Doesn't render the sections themselves — the page it's on
 * computes the resolved order server-side (lib/pillar-page/sections.ts's
 * resolveSectionOrder) and passes it in as `initialConfig`; saving here
 * calls router.refresh() so that server computation re-runs against the
 * newly persisted config.
 *
 * `pinnedTypes` marks section types whose *position* the page ignores (see
 * the Area page's North Star, pinned into its two-column grid with Current
 * state) — those rows still get the visibility checkbox, since that's
 * still honored, but no drag handle/up/down buttons, since dragging them
 * would silently do nothing visible and that's worse than not offering it. */
export function SectionManager({
  pillarId,
  areaId,
  initialConfig,
  pinnedTypes = [],
}: {
  pillarId: string;
  areaId: string | null;
  initialConfig: SectionConfigEntry[];
  pinnedTypes?: SectionType[];
}) {
  const router = useRouter();
  const { notifyError } = useToast();
  const [config, setConfig] = useState(initialConfig);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Pinned rows are never part of the reorder — they're rendered in their
  // own fixed-position group above it, checkbox only. This keeps the
  // reorderable rows' drag/move logic simple (it only ever permutes among
  // themselves) and means a pinned row can never be displaced by a
  // neighbor's move either, which a single interleaved array + skip-logic
  // would need extra bookkeeping to guarantee.
  const isPinned = (type: SectionConfigEntry["type"]) => pinnedTypes.includes(type);
  const pinned = config.filter((entry) => isPinned(entry.type));
  const reorderable = config.filter((entry) => !isPinned(entry.type));

  async function persist(next: SectionConfigEntry[]) {
    setConfig(next);
    const result = await withRetry(() =>
      areaId ? updateAreaSectionConfig(pillarId, areaId, next) : updatePillarSectionConfig(pillarId, next)
    );
    if (!result.ok) {
      notifyError(result.error, { onRetry: () => persist(next) });
      return;
    }
    router.refresh();
  }

  function togglePinned(type: SectionConfigEntry["type"]) {
    persist(config.map((entry) => (entry.type === type ? { ...entry, visible: !entry.visible } : entry)));
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= reorderable.length) return;
    const nextReorderable = [...reorderable];
    [nextReorderable[index], nextReorderable[target]] = [nextReorderable[target], nextReorderable[index]];
    persist([...pinned, ...nextReorderable]);
  }

  function toggle(index: number) {
    const nextReorderable = reorderable.map((entry, i) => (i === index ? { ...entry, visible: !entry.visible } : entry));
    persist([...pinned, ...nextReorderable]);
  }

  function handleDrop(index: number) {
    if (dragIndex === null || dragIndex === index) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }
    const nextReorderable = [...reorderable];
    const [moved] = nextReorderable.splice(dragIndex, 1);
    nextReorderable.splice(index, 0, moved);
    setDragIndex(null);
    setDragOverIndex(null);
    persist([...pinned, ...nextReorderable]);
  }

  return (
    <details className={styles.details}>
      <summary className={styles.summary}>
        <SlidersHorizontal size={14} strokeWidth={2} />
        Customize sections
      </summary>
      <ul className={styles.list}>
        {pinned.map((entry) => (
          <li key={entry.type} className={styles.row}>
            <label className={styles.checkboxLabel}>
              <input type="checkbox" checked={entry.visible} onChange={() => togglePinned(entry.type)} />
              <span className={entry.visible ? undefined : styles.hiddenLabel}>{SECTION_LABELS[entry.type]}</span>
            </label>
            <span className={styles.pinnedNote}>always here</span>
          </li>
        ))}
        {reorderable.map((entry, i) => (
          <li
            key={entry.type}
            className={`${styles.row} ${dragIndex === i ? styles.dragging : ""} ${dragOverIndex === i ? styles.dragOver : ""}`}
            draggable
            onDragStart={() => setDragIndex(i)}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOverIndex(i);
            }}
            onDrop={() => handleDrop(i)}
            onDragEnd={() => {
              setDragIndex(null);
              setDragOverIndex(null);
            }}
          >
            <GripVertical size={16} strokeWidth={2} className={styles.grip} aria-hidden />
            <label className={styles.checkboxLabel}>
              <input type="checkbox" checked={entry.visible} onChange={() => toggle(i)} />
              <span className={entry.visible ? undefined : styles.hiddenLabel}>{SECTION_LABELS[entry.type]}</span>
            </label>
            <div className={styles.arrows}>
              <button
                type="button"
                className={styles.arrowButton}
                onClick={() => move(i, -1)}
                disabled={i === 0}
                aria-label={`Move ${SECTION_LABELS[entry.type]} up`}
              >
                <ChevronUp size={15} strokeWidth={2} />
              </button>
              <button
                type="button"
                className={styles.arrowButton}
                onClick={() => move(i, 1)}
                disabled={i === reorderable.length - 1}
                aria-label={`Move ${SECTION_LABELS[entry.type]} down`}
              >
                <ChevronDown size={15} strokeWidth={2} />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </details>
  );
}

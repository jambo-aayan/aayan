"use client";

import { useState } from "react";
import { GripVertical, ChevronUp, ChevronDown } from "lucide-react";
import { useToast } from "@/components/toast/toast-provider";
import { withRetry } from "@/lib/with-retry";
import { setReviewRankOrder } from "@/lib/weekly-review/actions";
import type { RankCandidate } from "@/lib/weekly-review/data";
import styles from "./step-rerank.module.css";

export function StepRerank({ candidates: initial }: { candidates: RankCandidate[] }) {
  const { notifyError } = useToast();
  const [candidates, setCandidates] = useState(initial);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  async function persist(next: RankCandidate[]) {
    setCandidates(next);
    const result = await withRetry(() => setReviewRankOrder(next.map((c) => c.id)));
    if (!result.ok) notifyError(result.error, { onRetry: () => persist(next) });
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= candidates.length) return;
    const next = [...candidates];
    [next[index], next[target]] = [next[target], next[index]];
    persist(next);
  }

  function handleDrop(index: number) {
    if (dragIndex === null || dragIndex === index) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }
    const next = [...candidates];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(index, 0, moved);
    setDragIndex(null);
    setDragOverIndex(null);
    persist(next);
  }

  if (candidates.length === 0) {
    return <p className={styles.empty}>No candidates for next week yet — add a task or mark one important.</p>;
  }

  return (
    <ul className={styles.list}>
      {candidates.map((c, i) => (
        <li
          key={c.id}
          className={`${styles.row} ${i < 3 ? styles.topThree : ""} ${dragIndex === i ? styles.dragging : ""} ${dragOverIndex === i ? styles.dragOver : ""}`}
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
          <span className={styles.ordinal}>{i + 1}</span>
          <GripVertical size={16} strokeWidth={2} className={styles.grip} aria-hidden />
          <div className={styles.text}>
            <span className={styles.title}>{c.title}</span>
            {c.meta && <span className={styles.meta}>{c.meta}</span>}
          </div>
          <div className={styles.arrows}>
            <button type="button" className={styles.arrowButton} onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move "${c.title}" up`}>
              <ChevronUp size={15} strokeWidth={2} />
            </button>
            <button
              type="button"
              className={styles.arrowButton}
              onClick={() => move(i, 1)}
              disabled={i === candidates.length - 1}
              aria-label={`Move "${c.title}" down`}
            >
              <ChevronDown size={15} strokeWidth={2} />
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}

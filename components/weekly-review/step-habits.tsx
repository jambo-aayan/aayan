"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/toast/toast-provider";
import { withRetry } from "@/lib/with-retry";
import { setHabitVerdict } from "@/lib/weekly-review/actions";
import type { HabitReviewCard } from "@/lib/weekly-review/data";
import type { ReviewVerdict } from "@/lib/weekly-review/session";
import styles from "./step-habits.module.css";

const VERDICTS: { value: ReviewVerdict; label: string }[] = [
  { value: "KEEP", label: "Keep" },
  { value: "PAUSE", label: "Pause" },
  { value: "REWORK", label: "Rework" },
];

export function StepHabits({ cards: initialCards }: { cards: HabitReviewCard[] }) {
  const router = useRouter();
  const { notifyError } = useToast();
  const [cards, setCards] = useState(initialCards);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  async function handleVerdict(habitId: string, verdict: ReviewVerdict) {
    setPendingIds((prev) => new Set(prev).add(habitId));
    const result = await withRetry(() => setHabitVerdict(habitId, verdict));
    setPendingIds((prev) => {
      const next = new Set(prev);
      next.delete(habitId);
      return next;
    });
    if (!result.ok) {
      notifyError(result.error, { onRetry: () => handleVerdict(habitId, verdict) });
      return;
    }
    setCards((prev) => prev.map((c) => (c.id === habitId ? { ...c, verdict } : c)));
    router.refresh();
  }

  if (cards.length === 0) {
    return <p className={styles.empty}>No habits to review yet.</p>;
  }

  return (
    <div className={styles.grid}>
      {cards.map((card) => {
        const pending = pendingIds.has(card.id);
        const accent = card.pillarColor ?? "var(--ink)";
        return (
          <div key={card.id} className={styles.card}>
            <span className={styles.pillarPill} style={{ color: accent, borderColor: accent }}>
              {card.pillarName}
            </span>
            <span className={`${styles.rate} ${card.adherencePct >= 65 ? styles.rateGood : styles.rateBad}`}>{card.adherencePct}%</span>
            <span className={styles.name}>{card.name}</span>
            <div className={styles.strip} aria-hidden>
              {card.cells.map((cell, i) => (
                <span
                  key={i}
                  className={styles.cell}
                  style={{ background: cell === "none" ? "rgba(34, 30, 26, .055)" : accent, opacity: cell === "full" ? 0.85 : cell === "partial" ? 0.34 : 1 }}
                />
              ))}
            </div>
            <div className={styles.chips}>
              {VERDICTS.map((v) => (
                <button
                  key={v.value}
                  type="button"
                  className={`${styles.chip} ${card.verdict === v.value ? styles.chipActive : ""}`}
                  onClick={() => handleVerdict(card.id, v.value)}
                  disabled={pending}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

"use client";

import { useState } from "react";
import { cycleTodayCheckIn } from "@/lib/habits/actions";
import { withRetry } from "@/lib/with-retry";
import { useToast } from "@/components/toast/toast-provider";
import { ThoughtPrompt } from "@/components/thoughts/thought-prompt";
import styles from "./my-day-habits.module.css";

type CheckInLevel = "FULL" | "MINIMUM" | null;

export type MyDayHabit = {
  id: string;
  areaId: string;
  name: string;
  areaName: string;
  todayLevel: CheckInLevel;
};

function nextLevel(level: CheckInLevel): CheckInLevel {
  if (level === null) return "FULL";
  if (level === "FULL") return "MINIMUM";
  return null;
}

export function MyDayHabits({ initialHabits }: { initialHabits: MyDayHabit[] }) {
  const [habits, setHabits] = useState(initialHabits);
  const [error, setError] = useState<string | null>(null);
  // Blocks re-entrant clicks while a toggle's withRetry backoff is in
  // flight, so a slow first request's revert can't clobber a second toggle.
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [promptHabitId, setPromptHabitId] = useState<string | null>(null);
  const { notifyError } = useToast();

  async function handleToggle(habit: MyDayHabit) {
    if (pendingIds.has(habit.id)) return;
    setPendingIds((prev) => new Set(prev).add(habit.id));
    const newLevel = nextLevel(habit.todayLevel);
    setHabits((prev) => prev.map((h) => (h.id === habit.id ? { ...h, todayLevel: newLevel } : h)));
    const result = await withRetry(() => cycleTodayCheckIn(habit.id));
    if (!result.ok) {
      setHabits((prev) => prev.map((h) => (h.id === habit.id ? habit : h)));
      setError(result.error);
      notifyError(result.error, { onRetry: () => handleToggle(habit) });
    } else if (habit.todayLevel === null && newLevel !== null) {
      setPromptHabitId(habit.id);
    }
    setPendingIds((prev) => {
      const next = new Set(prev);
      next.delete(habit.id);
      return next;
    });
  }

  if (habits.length === 0) {
    return <p className={styles.empty}>No active habits yet.</p>;
  }

  return (
    <div>
      <ul className={styles.list}>
        {habits.map((habit) => (
          <li key={habit.id} className={styles.row}>
            <div>
              <div className={styles.name}>{habit.name}</div>
              <div className={styles.meta}>{habit.areaName}</div>
              {promptHabitId === habit.id && (
                <ThoughtPrompt areaId={habit.areaId} onDone={() => setPromptHabitId(null)} />
              )}
            </div>
            <button
              type="button"
              className={`${styles.dot} ${styles[habit.todayLevel?.toLowerCase() ?? "none"]}`}
              aria-label={`Check in: currently ${habit.todayLevel ?? "not checked in"}`}
              disabled={pendingIds.has(habit.id)}
              onClick={() => handleToggle(habit)}
            />
          </li>
        ))}
      </ul>
      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}

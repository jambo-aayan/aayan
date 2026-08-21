"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { cycleTodayCheckIn } from "@/lib/habits/actions";
import { nextCheckInLevel, type CheckInLevel } from "@/lib/habits/check-in";
import { withRetry } from "@/lib/with-retry";
import { useToast } from "@/components/toast/toast-provider";
import { ThoughtPrompt } from "@/components/thoughts/thought-prompt";
import { EmptyState } from "@/components/empty-state";
import { HabitDot } from "@/components/habit-dot";
import styles from "./my-day-habits.module.css";

export type MyDayHabit = {
  id: string;
  areaId: string | null;
  name: string;
  areaName: string | null;
  todayLevel: CheckInLevel;
  /** Already resolved to hex — see lib/colors.ts's resolveColorHex. */
  pillarColor: string | null;
};

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
    const newLevel = nextCheckInLevel(habit.todayLevel);
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
    return <EmptyState icon={CheckCircle2} message="No active habits yet." />;
  }

  return (
    <div>
      <ul className={styles.list}>
        {habits.map((habit) => (
          <li key={habit.id} className={styles.row}>
            <div>
              <div className={styles.name}>{habit.name}</div>
              {habit.areaName && <div className={styles.meta}>{habit.areaName}</div>}
              {promptHabitId === habit.id && habit.areaId && (
                <ThoughtPrompt areaId={habit.areaId} onDone={() => setPromptHabitId(null)} />
              )}
            </div>
            <HabitDot
              level={habit.todayLevel}
              accentColor={habit.pillarColor}
              size={30}
              label={`Check in "${habit.name}": currently ${habit.todayLevel ?? "not checked in"}`}
              onToggle={pendingIds.has(habit.id) ? undefined : () => handleToggle(habit)}
            />
          </li>
        ))}
      </ul>
      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}

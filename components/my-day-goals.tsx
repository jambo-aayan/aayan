"use client";

import { useRef, useState } from "react";
import { setActionGoalStatus } from "@/lib/action-goals/actions";
import type { GoalStatus } from "@/lib/action-goals/status";
import { withRetry } from "@/lib/with-retry";
import { useToast } from "@/components/toast/toast-provider";
import { ThoughtPrompt } from "@/components/thoughts/thought-prompt";
import styles from "./my-day-goals.module.css";

export type MyDayGoal = {
  id: string;
  areaId: string;
  name: string;
  areaName: string;
  status: GoalStatus;
  dueDate: Date | null;
};

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

export function MyDayGoals({ initialGoals }: { initialGoals: MyDayGoal[] }) {
  const [goals, setGoals] = useState(initialGoals);
  const [error, setError] = useState<string | null>(null);
  // Blocks re-entrant clicks while a toggle's withRetry backoff is in
  // flight, so a slow first request's revert can't clobber a second toggle.
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [promptGoalId, setPromptGoalId] = useState<string | null>(null);
  const { notifyError } = useToast();
  // Remembers each goal's status from just before it was marked DONE, so
  // unchecking restores it instead of always resetting to NOT_STARTED —
  // an IN_PROGRESS goal shouldn't lose that state from one checkbox tap.
  const statusBeforeDone = useRef<Record<string, GoalStatus>>({});

  async function handleToggleDone(goal: MyDayGoal) {
    if (pendingIds.has(goal.id)) return;
    setPendingIds((prev) => new Set(prev).add(goal.id));

    let newStatus: GoalStatus;
    if (goal.status === "DONE") {
      newStatus = statusBeforeDone.current[goal.id] ?? "NOT_STARTED";
    } else {
      statusBeforeDone.current[goal.id] = goal.status;
      newStatus = "DONE";
    }

    setGoals((prev) => prev.map((g) => (g.id === goal.id ? { ...g, status: newStatus } : g)));
    const result = await withRetry(() => setActionGoalStatus(goal.id, newStatus));
    if (!result.ok) {
      setGoals((prev) => prev.map((g) => (g.id === goal.id ? goal : g)));
      setError(result.error);
      notifyError(result.error, { onRetry: () => handleToggleDone(goal) });
    } else if (newStatus === "DONE") {
      setPromptGoalId(goal.id);
    }
    setPendingIds((prev) => {
      const next = new Set(prev);
      next.delete(goal.id);
      return next;
    });
  }

  if (goals.length === 0) {
    return <p className={styles.empty}>No goals flagged for My Day.</p>;
  }

  return (
    <div>
      <ul className={styles.list}>
        {goals.map((goal) => (
          <li key={goal.id} className={styles.row}>
            <label className={styles.check}>
              <input
                type="checkbox"
                checked={goal.status === "DONE"}
                disabled={pendingIds.has(goal.id)}
                onChange={() => handleToggleDone(goal)}
              />
              <div>
                <div className={goal.status === "DONE" ? styles.nameDone : styles.name}>{goal.name}</div>
                <div className={styles.meta}>
                  {goal.areaName}
                  {goal.dueDate && ` · due ${formatDate(goal.dueDate)}`}
                </div>
              </div>
            </label>
            {promptGoalId === goal.id && (
              <ThoughtPrompt areaId={goal.areaId} onDone={() => setPromptGoalId(null)} />
            )}
          </li>
        ))}
      </ul>
      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}

"use client";

import { useState } from "react";
import { setActionGoalStatus } from "@/lib/action-goals/actions";
import styles from "./my-day-goals.module.css";

export type MyDayGoal = {
  id: string;
  name: string;
  areaName: string;
  status: "NOT_STARTED" | "IN_PROGRESS" | "DONE";
  dueDate: Date | null;
};

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

export function MyDayGoals({ initialGoals }: { initialGoals: MyDayGoal[] }) {
  const [goals, setGoals] = useState(initialGoals);
  const [error, setError] = useState<string | null>(null);

  async function handleToggleDone(goal: MyDayGoal) {
    const newStatus = goal.status === "DONE" ? "NOT_STARTED" : "DONE";
    setGoals((prev) => prev.map((g) => (g.id === goal.id ? { ...g, status: newStatus } : g)));
    const result = await setActionGoalStatus(goal.id, newStatus);
    if (!result.ok) {
      setGoals((prev) => prev.map((g) => (g.id === goal.id ? goal : g)));
      setError(result.error);
    }
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
          </li>
        ))}
      </ul>
      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}

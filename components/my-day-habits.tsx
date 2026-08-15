"use client";

import { useState } from "react";
import { cycleTodayCheckIn } from "@/lib/habits/actions";
import styles from "./my-day-habits.module.css";

type CheckInLevel = "FULL" | "MINIMUM" | null;

export type MyDayHabit = {
  id: string;
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

  async function handleToggle(habit: MyDayHabit) {
    const newLevel = nextLevel(habit.todayLevel);
    setHabits((prev) => prev.map((h) => (h.id === habit.id ? { ...h, todayLevel: newLevel } : h)));
    const result = await cycleTodayCheckIn(habit.id);
    if (!result.ok) {
      setHabits((prev) => prev.map((h) => (h.id === habit.id ? habit : h)));
      setError(result.error);
    }
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
            </div>
            <button
              type="button"
              className={`${styles.dot} ${styles[habit.todayLevel?.toLowerCase() ?? "none"]}`}
              aria-label={`Check in: currently ${habit.todayLevel ?? "not checked in"}`}
              onClick={() => handleToggle(habit)}
            />
          </li>
        ))}
      </ul>
      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}

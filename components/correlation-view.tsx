"use client";

import { useState } from "react";
import { correlate } from "@/lib/pain-mobility/correlation";
import styles from "./correlation-view.module.css";

type Habit = { id: string; name: string; checkInDates: Date[] };
type PainLog = { date: Date; pain: number };

export function CorrelationView({ habits, painLogs }: { habits: Habit[]; painLogs: PainLog[] }) {
  const [habitId, setHabitId] = useState(habits[0]?.id ?? "");

  if (habits.length === 0) {
    return <p className={styles.empty}>Add and activate a habit in this Area to see a comparison.</p>;
  }

  const habit = habits.find((h) => h.id === habitId) ?? habits[0];
  const result = correlate(painLogs, habit.checkInDates);

  return (
    <div>
      <select className={styles.select} value={habitId} onChange={(e) => setHabitId(e.target.value)}>
        {habits.map((h) => (
          <option key={h.id} value={h.id}>
            {h.name}
          </option>
        ))}
      </select>

      {!result.ready ? (
        <p className={styles.notice}>
          Not enough data yet ({result.sampleSize} pain log{result.sampleSize === 1 ? "" : "s"} so far) — log
          pain on more days, with and without &ldquo;{habit.name}&rdquo;, to see a comparison. Needs at least
          3 logged days on each side.
        </p>
      ) : (
        <div>
          <p className={styles.notice}>
            On days you did &ldquo;{habit.name}&rdquo; ({result.habitDoneDays} logged), average pain was{" "}
            <strong>{result.habitDoneAvgPain.toFixed(1)}</strong>. On days you didn&rsquo;t (
            {result.habitNotDoneDays} logged), it was <strong>{result.habitNotDoneAvgPain.toFixed(1)}</strong>
            .
          </p>
          <p className={styles.disclaimer}>
            This is just a pattern in your own data, not a diagnosis or a conclusion — something worth
            raising with a clinician, not acting on alone.
          </p>
        </div>
      )}
    </div>
  );
}

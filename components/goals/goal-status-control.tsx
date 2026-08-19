"use client";

import { useState } from "react";
import { useToast } from "@/components/toast/toast-provider";
import { withRetry } from "@/lib/with-retry";
import { setGoalStatus } from "@/lib/goals/actions";
import type { LifeGoalStatus } from "@/lib/goals/data";
import styles from "./goal-status-control.module.css";

const STATUS_LABEL: Record<LifeGoalStatus, string> = { ACTIVE: "Active", PAUSED: "Paused", COMPLETED: "Completed", ARCHIVED: "Archived" };
const STATUS_ORDER: LifeGoalStatus[] = ["ACTIVE", "PAUSED", "COMPLETED", "ARCHIVED"];

export function GoalStatusControl({ goalId, initialStatus }: { goalId: string; initialStatus: LifeGoalStatus }) {
  const [status, setStatus] = useState(initialStatus);
  const { notifyError } = useToast();

  async function handleSet(next: LifeGoalStatus) {
    if (next === status) return;
    const prev = status;
    setStatus(next);
    const result = await withRetry(() => setGoalStatus(goalId, next));
    if (!result.ok) {
      setStatus(prev);
      notifyError(result.error, { onRetry: () => handleSet(next) });
    }
  }

  return (
    <div className={styles.group} role="group" aria-label="Status">
      {STATUS_ORDER.map((s) => (
        <button key={s} type="button" className={`${styles.btn} ${status === s ? styles.btnActive : ""}`} onClick={() => handleSet(s)}>
          {STATUS_LABEL[s]}
        </button>
      ))}
    </div>
  );
}

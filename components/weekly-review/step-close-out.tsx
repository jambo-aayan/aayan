"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TaskCheckbox } from "@/components/tasks/task-checkbox";
import { useToast } from "@/components/toast/toast-provider";
import { withRetry } from "@/lib/with-retry";
import { dropReviewTask, completeReviewTask, pushReviewTaskToNextWeek } from "@/lib/weekly-review/actions";
import type { StaleTask } from "@/lib/weekly-review/data";
import styles from "./step-close-out.module.css";

export function StepCloseOut({ tasks: initialTasks }: { tasks: StaleTask[] }) {
  const router = useRouter();
  const { notifyError } = useToast();
  const [tasks, setTasks] = useState(initialTasks);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  function remove(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  async function handleComplete(task: StaleTask) {
    setPendingIds((prev) => new Set(prev).add(task.id));
    const result = await withRetry(() => completeReviewTask(task.id));
    if (!result.ok) {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(task.id);
        return next;
      });
      notifyError(result.error, { onRetry: () => handleComplete(task) });
      return;
    }
    remove(task.id);
    router.refresh();
  }

  async function handleNextWeek(task: StaleTask) {
    const result = await withRetry(() => pushReviewTaskToNextWeek(task.id));
    if (!result.ok) {
      notifyError(result.error, { onRetry: () => handleNextWeek(task) });
      return;
    }
    remove(task.id);
    router.refresh();
  }

  async function handleDrop(task: StaleTask) {
    const result = await withRetry(() => dropReviewTask(task.id));
    if (!result.ok) {
      notifyError(result.error, { onRetry: () => handleDrop(task) });
      return;
    }
    remove(task.id);
    router.refresh();
  }

  if (tasks.length === 0) {
    return <p className={styles.empty}>Nothing open — a clean board going into next week.</p>;
  }

  return (
    <ul className={styles.list}>
      {tasks.map((task) => {
        const pending = pendingIds.has(task.id);
        return (
          <li key={task.id} className={styles.row}>
            <TaskCheckbox checked={false} onToggle={() => handleComplete(task)} disabled={pending} label={`Mark "${task.title}" done`} />
            <div className={styles.text}>
              <span className={styles.title}>{task.title}</span>
              <span className={styles.meta}>
                {task.listName ?? "Inbox"} · {task.dueLabel}
              </span>
            </div>
            <div className={styles.actions}>
              <button type="button" className={styles.nextWeekPill} onClick={() => handleNextWeek(task)}>
                Next week
              </button>
              <button type="button" className={styles.dropButton} onClick={() => handleDrop(task)}>
                Drop
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

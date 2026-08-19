"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { createTaskStep, toggleTaskStep, deleteTaskStep } from "@/lib/tasks/actions";
import { withRetry } from "@/lib/with-retry";
import type { TaskStep } from "@/lib/tasks/types";
import styles from "./task-steps.module.css";

/** Steps live only inside an already-saved Task — create mode has no taskId
 * yet, so the composer only renders this once the task exists (see
 * TaskComposer). Completing every Step never completes the parent Task;
 * that's deliberate, not missing wiring (see TaskStep's schema comment). */
export function TaskSteps({ taskId, initialSteps }: { taskId: string; initialSteps: TaskStep[] }) {
  const [steps, setSteps] = useState(initialSteps);
  const [text, setText] = useState("");
  const [adding, setAdding] = useState(false);

  async function handleAdd() {
    const title = text.trim();
    if (!title) return;
    setAdding(true);
    const result = await withRetry(() => createTaskStep(taskId, title));
    setAdding(false);
    if (result.ok) {
      setSteps((prev) => [...prev, { id: result.id, title, completed: false, sortOrder: prev.length }]);
      setText("");
    }
  }

  async function handleToggle(step: TaskStep) {
    setSteps((prev) => prev.map((s) => (s.id === step.id ? { ...s, completed: !s.completed } : s)));
    const result = await withRetry(() => toggleTaskStep(step.id, !step.completed));
    if (!result.ok) {
      setSteps((prev) => prev.map((s) => (s.id === step.id ? step : s)));
    }
  }

  async function handleDelete(step: TaskStep) {
    setSteps((prev) => prev.filter((s) => s.id !== step.id));
    const result = await withRetry(() => deleteTaskStep(step.id));
    if (!result.ok) {
      setSteps((prev) => [...prev, step].sort((a, b) => a.sortOrder - b.sortOrder));
    }
  }

  const doneCount = steps.filter((s) => s.completed).length;

  return (
    <div>
      {steps.length > 0 && (
        <div className={styles.progress}>
          {doneCount}/{steps.length} steps
        </div>
      )}
      <ul className={styles.list}>
        {steps.map((step) => (
          <li key={step.id} className={styles.row}>
            <label className={styles.check}>
              <input type="checkbox" checked={step.completed} onChange={() => handleToggle(step)} />
              <span className={step.completed ? styles.titleDone : styles.title}>{step.title}</span>
            </label>
            <button type="button" className={styles.remove} onClick={() => handleDelete(step)} aria-label={`Remove step "${step.title}"`}>
              <X size={13} strokeWidth={2} />
            </button>
          </li>
        ))}
      </ul>
      <div className={styles.addRow}>
        <input
          type="text"
          className={styles.input}
          placeholder="Add a step"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAdd();
            }
          }}
        />
        <button type="button" className={styles.add} onClick={handleAdd} disabled={adding || !text.trim()} aria-label="Add step">
          <Plus size={14} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}

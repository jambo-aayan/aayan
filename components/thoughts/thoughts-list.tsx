"use client";

import { useState } from "react";
import { deleteThought, restoreThought, type ThoughtInput } from "@/lib/thoughts/actions";
import { withRetry } from "@/lib/with-retry";
import { useToast } from "@/components/toast/toast-provider";
import styles from "./thoughts-list.module.css";

export type Thought = ThoughtInput & { id: string; tagName: string | null };

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

export function ThoughtsList({ initialThoughts }: { initialThoughts: Thought[] }) {
  const [thoughts, setThoughts] = useState(initialThoughts);
  const { notifyError, notifyUndo } = useToast();

  async function handleDelete(thought: Thought) {
    setThoughts((prev) => prev.filter((t) => t.id !== thought.id));
    const result = await withRetry(() => deleteThought(thought.id));
    if (!result.ok) {
      setThoughts((prev) => [...prev, thought].sort((a, b) => b.date.getTime() - a.date.getTime()));
      notifyError(result.error, { onRetry: () => handleDelete(thought) });
      return;
    }
    notifyUndo(`Deleted thought.`, () => handleUndo(thought));
  }

  async function handleUndo(thought: Thought) {
    const result = await withRetry(() => restoreThought(thought));
    if (!result.ok) {
      notifyError(result.error, { onRetry: () => handleUndo(thought) });
      return;
    }
    setThoughts((prev) => [...prev, thought].sort((a, b) => b.date.getTime() - a.date.getTime()));
  }

  if (thoughts.length === 0) {
    return <p className={styles.empty}>No thoughts yet.</p>;
  }

  return (
    <ul className={styles.list}>
      {thoughts.map((thought) => (
        <li key={thought.id} className={styles.row}>
          <div className={styles.head}>
            <span className={styles.date}>{formatDate(thought.date)}</span>
            {thought.tagName && <span className={styles.tag}>{thought.tagName}</span>}
            <button type="button" className={styles.delete} onClick={() => handleDelete(thought)}>
              Delete
            </button>
          </div>
          <p className={styles.text}>{thought.text}</p>
        </li>
      ))}
    </ul>
  );
}

"use client";

import { useState } from "react";
import { deleteThought, restoreThought, type ThoughtInput } from "@/lib/thoughts/actions";
import { withRetry } from "@/lib/with-retry";
import { useToast } from "@/components/toast/toast-provider";
import { resolveColorHex, type ColorKey } from "@/lib/colors";
import styles from "./thoughts-list.module.css";

export type Thought = ThoughtInput & { id: string; tagName: string | null; tagColor: string | null };

/** "Today" / "Yesterday" / "3d ago", falling back to a plain date beyond a
 * week — per the handoff's "relative timestamp" spec for thought cards.
 * Thought.date is a date-only value (midnight UTC, see the quick-add's
 * todayLocalDateString), so this works in day granularity, not hours. */
function formatRelative(date: Date): string {
  const days = Math.round((Date.now() - date.getTime()) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
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
      {thoughts.map((thought) => {
        const hex = resolveColorHex(thought.tagColor as ColorKey | null);
        return (
          <li key={thought.id} className={styles.card}>
            <p className={styles.text}>{thought.text}</p>
            <div className={styles.foot}>
              <span
                className={styles.tag}
                style={
                  thought.tagName && hex
                    ? { background: `${hex}22`, color: hex }
                    : undefined
                }
              >
                {thought.tagName ?? "Untagged"}
              </span>
              <span className={styles.date}>{formatRelative(thought.date)}</span>
              <button type="button" className={styles.delete} onClick={() => handleDelete(thought)}>
                Delete
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

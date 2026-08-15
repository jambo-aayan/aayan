"use client";

import { useId, useState } from "react";
import { createThought } from "@/lib/thoughts/actions";
import { withRetry } from "@/lib/with-retry";
import { useToast } from "@/components/toast/toast-provider";
import { todayLocalDateString } from "@/lib/local-date";
import styles from "./thought-prompt.module.css";

/**
 * A never-forced, dismissible offer to jot a Thought right after a habit
 * check-in or a goal status change — the moment the reflection is most
 * likely to actually happen, per issue #21. `onDone` fires on both an
 * explicit dismiss and a successful save, so the caller can drop the prompt
 * from state either way.
 */
export function ThoughtPrompt({
  areaId,
  onDone,
}: {
  areaId: string;
  onDone: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const { notifyError } = useToast();
  const textareaId = useId();

  async function handleSave() {
    if (!text.trim()) return;
    setSaving(true);
    const result = await withRetry(() =>
      createThought({
        text,
        date: new Date(`${todayLocalDateString()}T00:00:00.000Z`),
        pillarId: null,
        areaId,
      })
    );
    setSaving(false);
    if (!result.ok) {
      notifyError(result.error, { onRetry: handleSave });
      return;
    }
    onDone();
  }

  if (!expanded) {
    return (
      <div className={styles.prompt}>
        <span>Add a thought about this?</span>
        <button type="button" className={styles.link} onClick={() => setExpanded(true)}>
          Add
        </button>
        <button type="button" className={styles.link} onClick={onDone}>
          Dismiss
        </button>
      </div>
    );
  }

  return (
    <div className={styles.prompt}>
      <label className={styles.visuallyHidden} htmlFor={textareaId}>
        What&rsquo;s on your mind?
      </label>
      <textarea
        id={textareaId}
        className={styles.textarea}
        placeholder="What's on your mind?"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        autoFocus
      />
      <div className={styles.row}>
        <button type="button" className={styles.save} onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </button>
        <button type="button" className={styles.link} onClick={onDone}>
          Cancel
        </button>
      </div>
    </div>
  );
}

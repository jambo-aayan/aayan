"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createThought } from "@/lib/thoughts/actions";
import { withRetry } from "@/lib/with-retry";
import { useToast } from "@/components/toast/toast-provider";
import { todayLocalDateString } from "@/lib/local-date";
import { ThoughtsList, type Thought } from "@/components/thoughts/thoughts-list";
import { PrimaryButton } from "@/components/primary-button";
import styles from "./pillar-area-thoughts.module.css";

/** The Thoughts section on a generic Pillar/Area page (#158/ADR-0016) —
 * pairs the existing ThoughtsList (reused as-is) with a quick-add fixed to
 * this page's own pillarId/areaId, rather than components/thoughts/
 * thought-quick-add.tsx's tag picker — the tag is already implied by which
 * page this renders on, same "already known from context, no picker"
 * pattern as PillarAreaGoals. router.refresh() re-fetches ThoughtsList's
 * initialThoughts on save, since it owns its own list state internally. */
export function PillarAreaThoughts({
  pillarId,
  areaId,
  initialThoughts,
}: {
  pillarId: string;
  areaId: string | null;
  initialThoughts: Thought[];
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { notifyError } = useToast();

  async function handleAdd() {
    const trimmed = text.trim();
    if (!trimmed) {
      setError("Write something first.");
      return;
    }
    setSaving(true);
    setError(null);
    const result = await withRetry(() =>
      createThought({
        text: trimmed,
        date: new Date(`${todayLocalDateString()}T00:00:00.000Z`),
        pillarId,
        areaId,
      })
    );
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      notifyError(result.error, { onRetry: handleAdd });
      return;
    }
    setText("");
    router.refresh();
  }

  return (
    <div>
      <ThoughtsList initialThoughts={initialThoughts} />
      <div className={styles.addForm}>
        <input
          type="text"
          className={styles.addInput}
          placeholder="What's on your mind?"
          value={text}
          disabled={saving}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAdd();
            }
          }}
        />
        <PrimaryButton onClick={handleAdd} disabled={saving}>
          {saving ? "Adding…" : "Add"}
        </PrimaryButton>
      </div>
      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}

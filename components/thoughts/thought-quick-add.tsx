"use client";

import { useState } from "react";
import { createThought } from "@/lib/thoughts/actions";
import { withRetry } from "@/lib/with-retry";
import { useToast } from "@/components/toast/toast-provider";
import { todayLocalDateString } from "@/lib/local-date";
import styles from "./thought-quick-add.module.css";

type TagOption = { id: string; name: string; areas: { id: string; name: string }[] };

export function ThoughtQuickAdd({ tagOptions }: { tagOptions: TagOption[] }) {
  const [text, setText] = useState("");
  const [pillarId, setPillarId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const { notifyError } = useToast();

  async function handleSave() {
    if (!text.trim()) {
      setError("Write something first.");
      return;
    }
    setSaving(true);
    setError(null);
    const result = await withRetry(() =>
      createThought({
        text,
        date: new Date(`${todayLocalDateString()}T00:00:00.000Z`),
        pillarId,
        areaId: null,
      })
    );
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      notifyError(result.error, { onRetry: handleSave });
      return;
    }
    setText("");
    setPillarId(null);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div className={styles.quickAdd}>
      <div className={styles.head}>
        <span className={styles.dot} aria-hidden />
        <span className={styles.eyebrow}>Thought</span>
      </div>

      <label className={styles.visuallyHidden} htmlFor="thought-quick-add-text">
        What&rsquo;s on your mind?
      </label>
      <input
        id="thought-quick-add-text"
        type="text"
        className={styles.input}
        placeholder="What's on your mind?"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            handleSave();
          }
        }}
      />
      <div className={styles.row}>
        <div className={styles.chips}>
          <button type="button" className={`${styles.chip} ${pillarId === null ? styles.chipActive : ""}`} onClick={() => setPillarId(null)}>
            Untagged
          </button>
          {tagOptions.map((pillar) => (
            <button
              key={pillar.id}
              type="button"
              className={`${styles.chip} ${pillarId === pillar.id ? styles.chipActive : ""}`}
              onClick={() => setPillarId(pillar.id)}
            >
              {pillar.name}
            </button>
          ))}
        </div>
        <button type="button" className={styles.save} onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
      {saved && (
        <p className={styles.saved} role="status" aria-live="polite">
          Saved.
        </p>
      )}
      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}

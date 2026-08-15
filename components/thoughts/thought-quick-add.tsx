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
  const [tag, setTag] = useState(""); // "" | "pillar:<id>" | "area:<id>"
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const { notifyError } = useToast();

  async function handleSave() {
    if (!text.trim()) {
      setError("Write something first.");
      return;
    }
    const [kind, id] = tag ? tag.split(":") : [null, null];
    setSaving(true);
    setError(null);
    const result = await withRetry(() =>
      createThought({
        text,
        date: new Date(`${todayLocalDateString()}T00:00:00.000Z`),
        pillarId: kind === "pillar" ? id : null,
        areaId: kind === "area" ? id : null,
      })
    );
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      notifyError(result.error, { onRetry: handleSave });
      return;
    }
    setText("");
    setTag("");
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div className={styles.quickAdd}>
      <label className={styles.visuallyHidden} htmlFor="thought-quick-add-text">
        What&rsquo;s on your mind?
      </label>
      <textarea
        id="thought-quick-add-text"
        className={styles.textarea}
        placeholder="What's on your mind?"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
      />
      <div className={styles.row}>
        <label className={styles.visuallyHidden} htmlFor="thought-quick-add-tag">
          Tag to a Pillar or Area (optional)
        </label>
        <select
          id="thought-quick-add-tag"
          className={styles.select}
          value={tag}
          onChange={(e) => setTag(e.target.value)}
        >
          <option value="">No tag</option>
          {tagOptions.map((pillar) => (
            <optgroup key={pillar.id} label={pillar.name}>
              <option value={`pillar:${pillar.id}`}>{pillar.name} (general)</option>
              {pillar.areas.map((area) => (
                <option key={area.id} value={`area:${area.id}`}>
                  {area.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <button type="button" className={styles.save} onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Add thought"}
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

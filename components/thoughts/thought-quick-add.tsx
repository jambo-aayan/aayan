"use client";

import { useState } from "react";
import { Lightbulb, Tag, Plus } from "lucide-react";
import { createThought } from "@/lib/thoughts/actions";
import { withRetry } from "@/lib/with-retry";
import { useToast } from "@/components/toast/toast-provider";
import { todayLocalDateString } from "@/lib/local-date";
import { IconBadge } from "@/components/icon-badge";
import { PrimaryButton } from "@/components/primary-button";
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
      <div className={styles.head}>
        <IconBadge icon={Lightbulb} accent="thoughts" size={32} />
        <div>
          <div className={styles.title}>Thoughts</div>
          <div className={styles.subtitle}>Capture your thoughts, ideas and reflections.</div>
        </div>
      </div>

      <label className={styles.visuallyHidden} htmlFor="thought-quick-add-text">
        What&rsquo;s on your mind?
      </label>
      <textarea
        id="thought-quick-add-text"
        className={styles.textarea}
        placeholder="What's on your mind?"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
      />
      <div className={styles.row}>
        <div className={styles.selectWrap}>
          <Tag size={14} strokeWidth={2} className={styles.tagIcon} />
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
        </div>
        <PrimaryButton onClick={handleSave} disabled={saving} className={styles.save}>
          {saving ? "Saving…" : "Add thought"}
          <Plus size={14} strokeWidth={2.5} />
        </PrimaryButton>
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

"use client";

import { useState } from "react";
import styles from "./editable-text.module.css";
import type { SaveResult } from "@/lib/health/actions";

export function EditableText({
  label,
  initialValue,
  placeholder,
  onSave,
}: {
  label: string;
  initialValue: string | null;
  placeholder: string;
  onSave: (value: string) => Promise<SaveResult>;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialValue ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    const result = await onSave(value);
    setSaving(false);
    if (result.ok) {
      setEditing(false);
    } else {
      setError(result.error);
    }
  }

  if (!editing) {
    return (
      <div className={styles.field}>
        <div className={styles.label}>{label}</div>
        <button
          type="button"
          className={styles.display}
          onClick={() => setEditing(true)}
        >
          {initialValue || <span className={styles.placeholder}>{placeholder}</span>}
        </button>
      </div>
    );
  }

  return (
    <div className={styles.field}>
      <div className={styles.label}>{label}</div>
      <textarea
        className={styles.textarea}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        autoFocus
        rows={2}
      />
      {error && <p className={styles.error}>{error}</p>}
      <div className={styles.actions}>
        <button type="button" className={styles.save} onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          className={styles.cancel}
          onClick={() => {
            setValue(initialValue ?? "");
            setError(null);
            setEditing(false);
          }}
          disabled={saving}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

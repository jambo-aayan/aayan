"use client";

import { useState } from "react";
import { PrimaryButton } from "@/components/primary-button";
import { todayLocalDateString } from "@/lib/local-date";
import styles from "./add-record-form.module.css";

/** One ad-hoc data point, date defaulting to today (#163) — matches this
 * app's low-maintenance principle (CLAUDE.md #1): logging a new day's
 * value is two fields, not a full form. A compact inline trigger→form,
 * same pattern as NewAreaTile. */
export function AddRecordForm({ onAdd }: { onAdd: (date: string, value: number, note: string) => Promise<{ ok: boolean; error?: string }> }) {
  const [adding, setAdding] = useState(false);
  const [date, setDate] = useState(todayLocalDateString());
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setAdding(false);
    setDate(todayLocalDateString());
    setValue("");
    setNote("");
    setError(null);
  }

  async function handleAdd() {
    const parsed = Number(value);
    if (value.trim() === "" || Number.isNaN(parsed)) {
      setError("Enter a number.");
      return;
    }
    setSaving(true);
    setError(null);
    const result = await onAdd(date, parsed, note);
    setSaving(false);
    if (!result.ok) {
      setError(result.error ?? "Couldn't save — try again.");
      return;
    }
    reset();
  }

  if (!adding) {
    return (
      <button type="button" className={styles.trigger} onClick={() => setAdding(true)}>
        + Add data
      </button>
    );
  }

  return (
    <div className={styles.form}>
      <input type="date" className={styles.dateInput} value={date} disabled={saving} onChange={(e) => setDate(e.target.value)} />
      <input
        type="number"
        className={styles.valueInput}
        placeholder="Value"
        value={value}
        autoFocus
        disabled={saving}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleAdd()}
      />
      <input
        type="text"
        className={styles.dateInput}
        placeholder="Note (optional)"
        value={note}
        disabled={saving}
        onChange={(e) => setNote(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleAdd()}
      />
      <PrimaryButton onClick={handleAdd} disabled={saving}>
        {saving ? "Adding…" : "Add"}
      </PrimaryButton>
      <button type="button" className={styles.trigger} onClick={reset} disabled={saving}>
        Cancel
      </button>
      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}

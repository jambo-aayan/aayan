"use client";

import { useState } from "react";
import { PrimaryButton } from "@/components/primary-button";
import styles from "./add-record-form.module.css";

/** A mixed-binding Scatter's own add-data form (#167) — the bound axis
 * reads live data, so there's nothing to type in for it; this only ever
 * asks for the still-ad-hoc axis's value. Shares add-record-form.module.css's
 * classes, same as AddScatterRecordForm. */
export function AddScatterAxisForm({
  axisLabel,
  onAdd,
}: {
  axisLabel: string;
  onAdd: (value: number, note: string) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [adding, setAdding] = useState(false);
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setAdding(false);
    setValue("");
    setNote("");
    setError(null);
  }

  async function handleAdd() {
    const parsed = Number(value);
    if (value.trim() === "" || Number.isNaN(parsed)) {
      setError(`Enter a number for ${axisLabel}.`);
      return;
    }
    setSaving(true);
    setError(null);
    const result = await onAdd(parsed, note);
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
        + Add {axisLabel} value
      </button>
    );
  }

  return (
    <div className={styles.form}>
      <input
        type="number"
        className={styles.valueInput}
        placeholder={axisLabel}
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

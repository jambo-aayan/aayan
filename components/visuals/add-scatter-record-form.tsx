"use client";

import { useState } from "react";
import { PrimaryButton } from "@/components/primary-button";
import styles from "./add-record-form.module.css";

/** A Scatter chart's own add-data form (#164) — two numbers (X, Y), no
 * date, unlike AddRecordForm's date+value shape every other chart type
 * uses. Shares add-record-form.module.css's classes rather than
 * duplicating near-identical styling in a new module. */
export function AddScatterRecordForm({ onAdd }: { onAdd: (x: number, y: number, note: string) => Promise<{ ok: boolean; error?: string }> }) {
  const [adding, setAdding] = useState(false);
  const [x, setX] = useState("");
  const [y, setY] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setAdding(false);
    setX("");
    setY("");
    setNote("");
    setError(null);
  }

  async function handleAdd() {
    const parsedX = Number(x);
    const parsedY = Number(y);
    if (x.trim() === "" || y.trim() === "" || Number.isNaN(parsedX) || Number.isNaN(parsedY)) {
      setError("Enter a number for both X and Y.");
      return;
    }
    setSaving(true);
    setError(null);
    const result = await onAdd(parsedX, parsedY, note);
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
      <input
        type="number"
        className={styles.valueInput}
        placeholder="X"
        value={x}
        autoFocus
        disabled={saving}
        onChange={(e) => setX(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleAdd()}
      />
      <input
        type="number"
        className={styles.valueInput}
        placeholder="Y"
        value={y}
        disabled={saving}
        onChange={(e) => setY(e.target.value)}
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

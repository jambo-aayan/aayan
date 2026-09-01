"use client";

import { useState } from "react";
import { PrimaryButton } from "@/components/primary-button";
import type { TableColumnType } from "@/lib/generated/prisma/client";
import styles from "./table-visual.module.css";

const COLUMN_TYPES: { type: TableColumnType; label: string }[] = [
  { type: "TEXT", label: "Text" },
  { type: "NUMBER", label: "Number" },
  { type: "DATE", label: "Date" },
  { type: "CHECKBOX", label: "Checkbox" },
];

/** A freeform Table's "+ Column" trigger→form (#168) — name plus one of
 * the four column types; every existing row immediately gains this
 * column (empty cell) once added. */
export function AddTableColumnForm({
  onAdd,
}: {
  onAdd: (name: string, type: TableColumnType) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<TableColumnType>("TEXT");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setAdding(false);
    setName("");
    setType("TEXT");
    setError(null);
  }

  async function handleAdd() {
    if (!name.trim()) {
      setError("Give the column a name first.");
      return;
    }
    setSaving(true);
    setError(null);
    const result = await onAdd(name, type);
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
        + Column
      </button>
    );
  }

  return (
    <div className={styles.inlineForm}>
      <input
        type="text"
        className={styles.textInput}
        placeholder="Column name"
        value={name}
        autoFocus
        disabled={saving}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleAdd()}
      />
      <select className={styles.select} value={type} disabled={saving} onChange={(e) => setType(e.target.value as TableColumnType)}>
        {COLUMN_TYPES.map((c) => (
          <option key={c.type} value={c.type}>
            {c.label}
          </option>
        ))}
      </select>
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

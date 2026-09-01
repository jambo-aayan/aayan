"use client";

import { useState } from "react";
import type { TableColumnType } from "@/lib/generated/prisma/client";
import styles from "./table-visual.module.css";

function CheckboxCell({ value, onChange }: { value: unknown; onChange: (value: unknown) => void }) {
  return (
    <input type="checkbox" className={styles.checkboxInput} checked={value === true} onChange={(e) => onChange(e.target.checked)} />
  );
}

function DraftCell({
  type,
  value,
  onChange,
}: {
  type: Exclude<TableColumnType, "CHECKBOX">;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const initial = type === "NUMBER" ? (typeof value === "number" ? String(value) : "") : typeof value === "string" ? value : "";
  const [draft, setDraft] = useState(initial);

  function commit() {
    if (type === "NUMBER") {
      const parsed = Number(draft);
      onChange(draft.trim() === "" ? null : Number.isFinite(parsed) ? parsed : null);
      return;
    }
    onChange(draft.trim() === "" ? null : draft);
  }

  return (
    <input
      type={type === "DATE" ? "date" : type === "NUMBER" ? "number" : "text"}
      className={styles.cellInput}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
    />
  );
}

/** One inline-editable Table cell (#168) — the input shown depends on its
 * column's type. Text/Number/Date commit on blur, buffered through
 * DraftCell's own local draft state so typing doesn't fire a save per
 * keystroke; Checkbox commits immediately on toggle, same as any other
 * checkbox, and needs no draft state at all — split into two components
 * (rather than one with an early return before a conditional useState)
 * so each keeps a fixed, valid hook count of its own. */
export function TableCell({
  type,
  value,
  onChange,
}: {
  type: TableColumnType;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  if (type === "CHECKBOX") return <CheckboxCell value={value} onChange={onChange} />;
  return <DraftCell type={type} value={value} onChange={onChange} />;
}

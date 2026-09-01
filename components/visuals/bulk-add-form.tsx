"use client";

import { useState } from "react";
import { PrimaryButton } from "@/components/primary-button";
import { parseRecordsText, type ParseRecordsResult } from "@/lib/visuals/parse-records";
import styles from "./bulk-add-form.module.css";

/** Backfilling a chart's history — pasted text or a CSV file, both parsed
 * client-side through the same lib/visuals/parse-records.ts before any
 * server round-trip, so a bad row is caught and shown before insert
 * rather than after (#165). Only ad-hoc, date-based charts (Line/Bar/
 * Streak heatmap) get this — Scatter and Progress bar have their own
 * data shapes, out of this ticket's scope. */
export function BulkAddForm({
  onAdd,
}: {
  onAdd: (rows: { date: string; value: number; note?: string }[]) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState<ParseRecordsResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setOpen(false);
    setText("");
    setParsed(null);
    setError(null);
  }

  function handleParse(nextText: string) {
    setText(nextText);
    setParsed(nextText.trim() === "" ? null : parseRecordsText(nextText));
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const content = await file.text();
    handleParse(content);
  }

  async function handleConfirm() {
    if (!parsed || parsed.rows.length === 0) return;
    setSaving(true);
    setError(null);
    const result = await onAdd(parsed.rows.map((r) => ({ date: r.date, value: r.value, note: r.note })));
    setSaving(false);
    if (!result.ok) {
      setError(result.error ?? "Couldn't save — try again.");
      return;
    }
    reset();
  }

  if (!open) {
    return (
      <button type="button" className={styles.trigger} onClick={() => setOpen(true)}>
        + Bulk add
      </button>
    );
  }

  return (
    <div className={styles.panel}>
      <p className={styles.hint}>One row per line: date, value (e.g. 2026-01-15, 72) — or upload a CSV in the same shape.</p>
      <textarea
        className={styles.textarea}
        value={text}
        disabled={saving}
        onChange={(e) => handleParse(e.target.value)}
        placeholder={"2026-01-15, 72\n2026-01-16, 74"}
      />
      <div className={styles.row}>
        <label className={styles.fileLabel}>
          <input type="file" accept=".csv,text/csv" onChange={handleFileUpload} disabled={saving} hidden />
          Upload CSV
        </label>
      </div>

      {parsed && (
        <span className={styles.summary}>
          {parsed.rows.length} row{parsed.rows.length === 1 ? "" : "s"} ready
          {parsed.errors.length > 0 && `, ${parsed.errors.length} skipped`}
        </span>
      )}
      {parsed && parsed.errors.length > 0 && (
        <ul className={styles.skipped}>
          {parsed.errors.map((e) => (
            <li key={e.line}>
              Line {e.line}: {e.message}
            </li>
          ))}
        </ul>
      )}
      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.row}>
        <PrimaryButton onClick={handleConfirm} disabled={saving || !parsed || parsed.rows.length === 0}>
          {saving ? "Adding…" : `Add ${parsed?.rows.length ?? 0} record${parsed?.rows.length === 1 ? "" : "s"}`}
        </PrimaryButton>
        <button type="button" className={styles.trigger} onClick={reset} disabled={saving}>
          Cancel
        </button>
      </div>
    </div>
  );
}

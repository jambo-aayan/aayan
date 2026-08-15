"use client";

import { useState } from "react";
import { surplus } from "@/lib/finance/baseline-math";
import { updateBaseline } from "@/lib/finance/actions";
import styles from "./baseline-form.module.css";

function formatGBP(value: number): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(value);
}

export function BaselineForm({
  initialIncome,
  initialOutgoings,
}: {
  initialIncome: number;
  initialOutgoings: number;
}) {
  const [income, setIncome] = useState(String(initialIncome));
  const [outgoings, setOutgoings] = useState(String(initialOutgoings));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const incomeNum = Number(income);
  const outgoingsNum = Number(outgoings);
  const valid = Number.isFinite(incomeNum) && Number.isFinite(outgoingsNum);

  async function handleSave() {
    if (!valid) {
      setError("Enter valid numbers.");
      return;
    }
    setSaving(true);
    setError(null);
    const result = await updateBaseline(incomeNum, outgoingsNum);
    setSaving(false);
    if (!result.ok) setError(result.error);
  }

  return (
    <div>
      <div className={styles.row}>
        <label className={styles.field}>
          <span className={styles.label}>Monthly income</span>
          <input
            type="number"
            step="0.01"
            value={income}
            onChange={(e) => setIncome(e.target.value)}
            className={styles.input}
          />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>Fixed outgoings</span>
          <input
            type="number"
            step="0.01"
            value={outgoings}
            onChange={(e) => setOutgoings(e.target.value)}
            className={styles.input}
          />
        </label>
      </div>
      <div className={styles.surplus}>
        Surplus: <strong>{valid ? formatGBP(surplus(incomeNum, outgoingsNum)) : "—"}</strong>
      </div>
      {error && <p className={styles.error}>{error}</p>}
      <button type="button" className={styles.save} onClick={handleSave} disabled={saving}>
        {saving ? "Saving…" : "Save"}
      </button>
    </div>
  );
}

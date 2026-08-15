"use client";

import { useState } from "react";
import { requiredMonthlyRate, verdict, projectedValue } from "@/lib/finance/north-star-math";
import { updateFinanceNorthStar } from "@/lib/finance/actions";
import styles from "./finance-north-star-card.module.css";

const PROJECTION_YEARS = 5;

function formatGBP(value: number): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(
    value
  );
}

function toDateInputValue(date: Date | null): string {
  return date ? date.toISOString().slice(0, 10) : "";
}

export function FinanceNorthStarCard({
  initialTarget,
  initialDeadline,
  accessibleNetWorth,
  actualMonthlyRate,
}: {
  initialTarget: number | null;
  initialDeadline: Date | null;
  accessibleNetWorth: number;
  actualMonthlyRate: number;
}) {
  const [target, setTarget] = useState(initialTarget !== null ? String(initialTarget) : "");
  const [deadline, setDeadline] = useState(toDateInputValue(initialDeadline));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState({ target: initialTarget, deadline: initialDeadline });

  async function handleSave() {
    const targetNum = target === "" ? null : Number(target);
    const deadlineDate = deadline === "" ? null : new Date(`${deadline}T00:00:00.000Z`);
    if (target !== "" && !Number.isFinite(targetNum)) {
      setError("Enter a valid target amount.");
      return;
    }
    setSaving(true);
    setError(null);
    const result = await updateFinanceNorthStar(targetNum, deadlineDate);
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSaved({ target: targetNum, deadline: deadlineDate });
  }

  const hasNorthStar = saved.target !== null && saved.deadline !== null;
  const required = hasNorthStar
    ? requiredMonthlyRate(accessibleNetWorth, saved.target!, saved.deadline!, new Date())
    : 0;
  const status = hasNorthStar ? verdict(actualMonthlyRate, required) : null;
  const projected = projectedValue(accessibleNetWorth, actualMonthlyRate, PROJECTION_YEARS);

  return (
    <div>
      {hasNorthStar && (
        <p className={status === "ON_TRACK" ? styles.onTrack : styles.behind}>
          {formatGBP(saved.target!)} by {new Date(saved.deadline!).toLocaleDateString("en-GB")} —{" "}
          {status === "ON_TRACK" ? "On track" : "Behind"}. Needs {formatGBP(required)}/mo, currently saving{" "}
          {formatGBP(actualMonthlyRate)}/mo.
        </p>
      )}
      <p className={styles.projection}>
        On current trajectory: {formatGBP(projected)} in {PROJECTION_YEARS} years.
      </p>

      <div className={styles.row}>
        <label className={styles.field}>
          <span className={styles.label}>Target</span>
          <input
            type="number"
            step="0.01"
            className={styles.input}
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>Deadline</span>
          <input
            type="date"
            className={styles.input}
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
          />
        </label>
      </div>
      {error && <p className={styles.error}>{error}</p>}
      <button type="button" className={styles.save} onClick={handleSave} disabled={saving}>
        {saving ? "Saving…" : "Save"}
      </button>
    </div>
  );
}

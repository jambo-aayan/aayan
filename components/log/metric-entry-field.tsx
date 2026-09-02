"use client";

import { useState } from "react";
import { logMetricEntry } from "@/lib/metrics/actions";
import { withRetry } from "@/lib/with-retry";
import { useToast } from "@/components/toast/toast-provider";
import type { MetricValueType } from "@/lib/metrics/logic";
import styles from "./metric-entry-field.module.css";

function parseEnumOptions(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * One Metric's entry control, shape driven by its valueType (#184) — the
 * one place every one of the 5 value types' input UI lives, reused by
 * both a DAILY/WEEKLY metric's period entry (editable in place, `date` is
 * that period's start) and an AD_HOC metric's fresh log (`date` is
 * `new Date()` at submit time, the field clears after saving rather than
 * holding a persisted "current value" — an AD_HOC metric can log more
 * than once in a day, so there's no one value to show as "current").
 */
export function MetricEntryField({
  metricId,
  date,
  valueType,
  enumOptions,
  unit,
  initialNumberValue,
  initialTextValue,
  isAdHoc,
}: {
  metricId: string;
  date: Date;
  valueType: MetricValueType;
  enumOptions: string | null;
  unit: string | null;
  initialNumberValue: number | null;
  initialTextValue: string | null;
  isAdHoc: boolean;
}) {
  const [numberValue, setNumberValue] = useState<number | null>(initialNumberValue);
  const [textValue, setTextValue] = useState<string | null>(initialTextValue);
  const [saving, setSaving] = useState(false);
  const [justLogged, setJustLogged] = useState(false);
  const { notifyError } = useToast();
  const options = parseEnumOptions(enumOptions);

  async function save(nextNumber: number | null, nextText: string | null, logDate: Date) {
    setSaving(true);
    const result = await withRetry(() => logMetricEntry(metricId, logDate, nextNumber, nextText));
    setSaving(false);
    if (!result.ok) {
      notifyError(result.error, { onRetry: () => save(nextNumber, nextText, logDate) });
      return;
    }
    if (isAdHoc) {
      setNumberValue(null);
      setTextValue(null);
      setJustLogged(true);
      setTimeout(() => setJustLogged(false), 2000);
    }
  }

  const logDate = isAdHoc ? new Date() : date;

  if (valueType === "SCALE_5") {
    return (
      <div className={styles.scaleRow}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            className={`${styles.scaleDot} ${numberValue === n ? styles.scaleDotActive : ""}`}
            aria-pressed={numberValue === n}
            disabled={saving}
            onClick={() => {
              setNumberValue(n);
              save(n, null, logDate);
            }}
          >
            {n}
          </button>
        ))}
        {justLogged && <span className={styles.loggedNote}>Logged</span>}
      </div>
    );
  }

  if (valueType === "BOOLEAN") {
    return (
      <div className={styles.optionRow}>
        {[
          { label: "Yes", value: 1 },
          { label: "No", value: 0 },
        ].map((opt) => (
          <button
            key={opt.label}
            type="button"
            className={`${styles.option} ${numberValue === opt.value ? styles.optionActive : ""}`}
            aria-pressed={numberValue === opt.value}
            disabled={saving}
            onClick={() => {
              setNumberValue(opt.value);
              save(opt.value, null, logDate);
            }}
          >
            {opt.label}
          </button>
        ))}
        {justLogged && <span className={styles.loggedNote}>Logged</span>}
      </div>
    );
  }

  if (valueType === "ENUM") {
    return (
      <div className={styles.optionRow}>
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            className={`${styles.option} ${textValue === opt ? styles.optionActive : ""}`}
            aria-pressed={textValue === opt}
            disabled={saving}
            onClick={() => {
              setTextValue(opt);
              save(null, opt, logDate);
            }}
          >
            {opt}
          </button>
        ))}
        {justLogged && <span className={styles.loggedNote}>Logged</span>}
      </div>
    );
  }

  if (valueType === "TEXT") {
    return (
      <div className={styles.textRow}>
        <input
          type="text"
          className={styles.textInput}
          value={textValue ?? ""}
          disabled={saving}
          onChange={(e) => setTextValue(e.target.value || null)}
          onBlur={() => save(null, textValue, logDate)}
        />
        {justLogged && <span className={styles.loggedNote}>Logged</span>}
      </div>
    );
  }

  // NUMBER
  return (
    <div className={styles.textRow}>
      <input
        type="number"
        step="any"
        className={styles.numberInput}
        placeholder="—"
        value={numberValue ?? ""}
        disabled={saving}
        onChange={(e) => setNumberValue(e.target.value === "" ? null : Number(e.target.value))}
        onBlur={() => save(numberValue, null, logDate)}
      />
      {unit && <span className={styles.unit}>{unit}</span>}
      {justLogged && <span className={styles.loggedNote}>Logged</span>}
    </div>
  );
}

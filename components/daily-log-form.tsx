"use client";

import { useState } from "react";
import { saveDailyLog } from "@/lib/daily-log/actions";
import { applyHeadacheTap, type HeadacheLevel, type StiffnessBucket, type DailyLogInput } from "@/lib/daily-log/logic";
import { withRetry } from "@/lib/with-retry";
import { useToast } from "@/components/toast/toast-provider";
import styles from "./daily-log-form.module.css";

const STIFFNESS_OPTIONS: { value: StiffnessBucket; label: string }[] = [
  { value: "UNDER_15", label: "Under 15 min" },
  { value: "15_TO_30", label: "15–30 min" },
  { value: "30_TO_60", label: "30–60 min" },
  { value: "OVER_60", label: "Over an hour" },
];

const HEADACHE_OPTIONS: { value: HeadacheLevel; label: string }[] = [
  { value: "NONE", label: "None" },
  { value: "MILD", label: "Mild" },
  { value: "MODERATE", label: "Moderate" },
  { value: "BAD", label: "Bad" },
];

export type DailyLogFormInitial = {
  date: Date;
  mood: number;
  stress: number;
  energy: number;
  sleepQuality: number;
  pain: number;
  headache: HeadacheLevel;
  stiffnessBucket: StiffnessBucket | null;
  weight: number | null;
  waist: number | null;
  bpSystolic: number | null;
  bpDiastolic: number | null;
};

function ScaleField({ label, value, onChange }: { label: string; value: number; onChange: (next: number) => void }) {
  return (
    <label className={styles.field}>
      <span className={styles.label}>{label}</span>
      <div className={styles.scaleRow}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            className={`${styles.scaleDot} ${value === n ? styles.scaleDotActive : ""}`}
            aria-pressed={value === n}
            onClick={() => onChange(n)}
          >
            {n}
          </button>
        ))}
      </div>
    </label>
  );
}

function OptionalNumberField({
  label,
  value,
  onChange,
  step = 0.1,
  base,
}: {
  label: string;
  value: number | null;
  onChange: (next: number | null) => void;
  step?: number;
  /** The sensible starting point to step from once the field is touched — a
   * blank field ("—") never has a default value shown until the user acts. */
  base: number;
}) {
  return (
    <label className={styles.field}>
      <span className={styles.label}>{label}</span>
      <input
        type="number"
        step={step}
        className={styles.input}
        placeholder="—"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        onFocus={() => value === null && onChange(base)}
      />
    </label>
  );
}

export function DailyLogForm({ initial }: { initial: DailyLogFormInitial }) {
  const [mood, setMood] = useState(initial.mood);
  const [stress, setStress] = useState(initial.stress);
  const [energy, setEnergy] = useState(initial.energy);
  const [sleepQuality, setSleepQuality] = useState(initial.sleepQuality);
  const [pain, setPain] = useState(initial.pain);
  const [stiffnessBucket, setStiffnessBucket] = useState<StiffnessBucket | null>(initial.stiffnessBucket);
  const [headache, setHeadache] = useState<HeadacheLevel>(initial.headache);
  const [weight, setWeight] = useState<number | null>(initial.weight);
  const [waist, setWaist] = useState<number | null>(initial.waist);
  const [bpSystolic, setBpSystolic] = useState<number | null>(initial.bpSystolic);
  const [bpDiastolic, setBpDiastolic] = useState<number | null>(initial.bpDiastolic);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const { notifyError } = useToast();

  // The day's-worst rule (DATA_MODEL.md §7): a lower tap silently keeps the
  // current value — no error, the control just doesn't move. This isn't a
  // failure case, it's the field correctly reflecting what already happened
  // today (see docs/adr/0007-v2-phase3-daily-log-sheet.md).
  function tapHeadache(tapped: HeadacheLevel) {
    setHeadache((current) => applyHeadacheTap(current, tapped));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);
    const input: DailyLogInput = {
      mood,
      stress,
      energy,
      sleepQuality,
      pain,
      headache,
      stiffnessBucket,
      weight,
      waist,
      bpSystolic,
      bpDiastolic,
    };
    const result = await withRetry(() => saveDailyLog(initial.date, input));
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      notifyError(result.error, { onRetry: handleSave });
      return;
    }
    // Reconcile against what the server actually persisted — day's-worst
    // folding happens server-side too, so a concurrent save elsewhere could
    // have raised headache beyond what this tab just submitted.
    setHeadache(result.headache);
    setSaved(true);
  }

  return (
    <div className={styles.form}>
      <div className={styles.group}>
        <div className={styles.groupLabel}>How was today</div>
        <ScaleField label="Mood" value={mood} onChange={setMood} />
        <ScaleField label="Stress" value={stress} onChange={setStress} />
        <ScaleField label="Energy" value={energy} onChange={setEnergy} />
        <ScaleField label="Sleep quality" value={sleepQuality} onChange={setSleepQuality} />
      </div>

      <div className={styles.group}>
        <div className={styles.groupLabel}>Body, today</div>
        <ScaleField label="Pain" value={pain} onChange={setPain} />

        <label className={styles.field}>
          <span className={styles.label}>Morning stiffness</span>
          <div className={styles.optionRow}>
            {STIFFNESS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`${styles.option} ${stiffnessBucket === opt.value ? styles.optionActive : ""}`}
                aria-pressed={stiffnessBucket === opt.value}
                onClick={() => setStiffnessBucket(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Headache (worst today)</span>
          <div className={styles.optionRow}>
            {HEADACHE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`${styles.option} ${headache === opt.value ? styles.optionActive : ""}`}
                aria-pressed={headache === opt.value}
                onClick={() => tapHeadache(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </label>
      </div>

      <div className={styles.group}>
        <div className={styles.groupLabel}>Numbers, whenever you have them</div>
        <OptionalNumberField label="Weight (kg)" value={weight} onChange={setWeight} step={0.1} base={70} />
        <OptionalNumberField label="Waist (cm)" value={waist} onChange={setWaist} step={0.5} base={85} />
        <OptionalNumberField label="BP systolic" value={bpSystolic} onChange={setBpSystolic} step={1} base={120} />
        <OptionalNumberField label="BP diastolic" value={bpDiastolic} onChange={setBpDiastolic} step={1} base={80} />
      </div>

      <button type="button" className={styles.save} onClick={handleSave} disabled={saving}>
        {saving ? "Saving…" : "Save"}
      </button>
      {saved && !error && <p className={styles.saved}>Saved.</p>}
      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}

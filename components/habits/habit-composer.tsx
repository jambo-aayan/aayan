"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { PrimaryButton } from "@/components/primary-button";
import { useDialogFocusTrap } from "@/components/use-dialog-focus-trap";
import type { HabitScheduleType } from "@/lib/habits/schedule";
import type { HabitWithRelations } from "@/lib/habits/data";
import styles from "./habit-composer.module.css";

const SCHEDULE_TYPES: { value: HabitScheduleType; label: string }[] = [
  { value: "DAILY", label: "Daily" },
  { value: "WEEKDAYS", label: "Weekdays (Mon-Fri)" },
  { value: "SELECTED_WEEKDAYS", label: "Selected days" },
  { value: "WEEKLY", label: "Weekly (any day)" },
  { value: "EVERY_N_DAYS", label: "Every N days" },
  { value: "EVERY_N_WEEKS", label: "Every N weeks" },
  { value: "MONTHLY", label: "Monthly" },
  { value: "CUSTOM", label: "Custom" },
];

const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export type HabitFormInput = {
  name: string;
  pillarId: string;
  areaId: string | null;
  scheduleType: HabitScheduleType;
  scheduleWeekdays: number[];
  scheduleIntervalN: number | null;
  goalIds: string[];
  primaryGoalId: string | null;
};

export function HabitComposer({
  mode,
  habit,
  pillars,
  areas,
  goals,
  onClose,
  onSubmit,
}: {
  mode: "create" | "edit";
  habit?: HabitWithRelations;
  pillars: { id: string; name: string; color?: string | null }[];
  areas: { id: string; name: string; pillarId: string }[];
  goals: { id: string; name: string; pillarId: string }[];
  onClose: () => void;
  onSubmit: (input: HabitFormInput) => Promise<{ ok: true } | { ok: false; error: string }>;
}) {
  const [name, setName] = useState(habit?.name ?? "");
  const [pillarId, setPillarId] = useState(habit?.pillarId ?? pillars[0]?.id ?? "");
  const [areaId, setAreaId] = useState(habit?.areaId ?? "");
  const [scheduleType, setScheduleType] = useState<HabitScheduleType>(habit?.scheduleType ?? "DAILY");
  const [scheduleWeekdays, setScheduleWeekdays] = useState<number[]>(habit?.scheduleWeekdays ?? []);
  const [scheduleIntervalN, setScheduleIntervalN] = useState<string>(habit?.scheduleIntervalN?.toString() ?? "");
  const [goalIds, setGoalIds] = useState<string[]>(habit?.goals.map((g) => g.id) ?? []);
  const [primaryGoalId, setPrimaryGoalId] = useState<string | null>(habit?.primaryGoal?.id ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sheetRef = useRef<HTMLDivElement>(null);
  useDialogFocusTrap(sheetRef);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const pillarGoals = goals.filter((g) => g.pillarId === pillarId);

  function toggleWeekday(day: number) {
    setScheduleWeekdays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  }

  function toggleGoal(goalId: string) {
    setGoalIds((prev) => {
      if (prev.includes(goalId)) {
        if (primaryGoalId === goalId) setPrimaryGoalId(null);
        return prev.filter((id) => id !== goalId);
      }
      return [...prev, goalId];
    });
  }

  async function handleSubmit() {
    if (!name.trim()) {
      setError("Give the habit a name first.");
      return;
    }
    if (!pillarId) {
      setError("Choose a Pillar first.");
      return;
    }
    setSaving(true);
    setError(null);
    const result = await onSubmit({
      name: name.trim(),
      pillarId,
      areaId: areaId || null,
      scheduleType,
      scheduleWeekdays: scheduleType === "SELECTED_WEEKDAYS" ? scheduleWeekdays : [],
      scheduleIntervalN:
        scheduleType === "EVERY_N_DAYS" || scheduleType === "EVERY_N_WEEKS"
          ? parseInt(scheduleIntervalN, 10) || 1
          : null,
      goalIds,
      primaryGoalId: goalIds.includes(primaryGoalId ?? "") ? primaryGoalId : goalIds[0] ?? null,
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onClose();
  }

  return (
    <>
      <div className={styles.overlay} onClick={onClose} aria-hidden />
      <div
        ref={sheetRef}
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-label={mode === "create" ? "New habit" : "Edit habit"}
        tabIndex={-1}
      >
        <div className={styles.header}>
          <h2 className={styles.heading}>{mode === "create" ? "New habit" : "Edit habit"}</h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        <div className={styles.body}>
          <input
            type="text"
            className={styles.titleInput}
            placeholder="Habit name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            aria-label="Habit name"
          />

          <div className={styles.field}>
            <span className={styles.label}>Pillar</span>
            <div className={styles.chips}>
              {pillars.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`${styles.chip} ${pillarId === p.id ? styles.chipActive : ""}`}
                  onClick={() => {
                    setPillarId(p.id);
                    if (areaId && areas.find((a) => a.id === areaId)?.pillarId !== p.id) setAreaId("");
                    setGoalIds([]);
                    setPrimaryGoalId(null);
                  }}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          <label className={styles.field}>
            <span className={styles.label}>Area (optional)</span>
            <select className={styles.select} value={areaId} onChange={(e) => setAreaId(e.target.value)}>
              <option value="">No area</option>
              {areas.filter((a) => a.pillarId === pillarId).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>

          <div className={styles.field}>
            <span className={styles.label}>Schedule</span>
            <div className={styles.chips}>
              {SCHEDULE_TYPES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  className={`${styles.chip} ${scheduleType === s.value ? styles.chipActive : ""}`}
                  onClick={() => setScheduleType(s.value)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {scheduleType === "SELECTED_WEEKDAYS" && (
            <div className={styles.weekdays}>
              {WEEKDAY_NAMES.map((label, day) => (
                <button
                  key={day}
                  type="button"
                  className={`${styles.weekdaySquare} ${scheduleWeekdays.includes(day) ? styles.weekdaySquareActive : ""}`}
                  onClick={() => toggleWeekday(day)}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {(scheduleType === "EVERY_N_DAYS" || scheduleType === "EVERY_N_WEEKS") && (
            <label className={styles.field}>
              <span className={styles.label}>Every N {scheduleType === "EVERY_N_DAYS" ? "days" : "weeks"}</span>
              <input
                type="number"
                min={1}
                className={styles.textInput}
                value={scheduleIntervalN}
                onChange={(e) => setScheduleIntervalN(e.target.value)}
              />
            </label>
          )}

          {scheduleType === "CUSTOM" && (
            <p className={styles.hint}>Custom schedules don&rsquo;t auto-generate occurrences yet — check in manually.</p>
          )}

          <div className={styles.field}>
            <span className={styles.label}>Goals in this Pillar (optional)</span>
            {pillarGoals.length === 0 && <p className={styles.hint}>No Goals yet in this Pillar.</p>}
            <div className={styles.goalList}>
              {pillarGoals.map((g) => (
                <div key={g.id} className={styles.goalRow}>
                  <label className={styles.goalCheck}>
                    <input type="checkbox" checked={goalIds.includes(g.id)} onChange={() => toggleGoal(g.id)} />
                    {g.name}
                  </label>
                  {goalIds.includes(g.id) && (
                    <button
                      type="button"
                      className={`${styles.primaryToggle} ${primaryGoalId === g.id ? styles.primaryToggleActive : ""}`}
                      onClick={() => setPrimaryGoalId(g.id)}
                    >
                      ★ {primaryGoalId === g.id ? "Primary" : "Make primary"}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {error && <p className={styles.error}>{error}</p>}
        </div>

        <div className={styles.footer}>
          <button type="button" className={styles.cancelBtn} onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <PrimaryButton onClick={handleSubmit} disabled={saving}>
            {saving ? "Saving…" : mode === "create" ? "Create habit" : "Save changes"}
          </PrimaryButton>
        </div>
      </div>
    </>
  );
}

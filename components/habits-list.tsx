"use client";

import { useState } from "react";
import { dailyStreak, weeklyStreak, isEstablished, type Frequency } from "@/lib/habits/streak";
import {
  createHabit,
  updateHabit,
  deleteHabit,
  restoreHabit,
  setHabitActive,
  cycleTodayCheckIn,
  type DeletedHabit,
} from "@/lib/habits/actions";
import { utcMidnight } from "@/lib/habits/date-utils";
import { withRetry } from "@/lib/with-retry";
import { useToast } from "@/components/toast/toast-provider";
import { ThoughtPrompt } from "@/components/thoughts/thought-prompt";
import styles from "./habits-list.module.css";

const UNDO_WINDOW_MS = 5000;

type CheckInLevel = "FULL" | "MINIMUM" | null;

export type HabitWithCheckIns = {
  id: string;
  areaId: string;
  name: string;
  frequency: Frequency;
  active: boolean;
  checkInDates: Date[];
  todayLevel: CheckInLevel;
};

function streakFor(habit: HabitWithCheckIns): number {
  return habit.frequency === "DAILY" ? dailyStreak(habit.checkInDates) : weeklyStreak(habit.checkInDates);
}

function nextLevel(level: CheckInLevel): CheckInLevel {
  if (level === null) return "FULL";
  if (level === "FULL") return "MINIMUM";
  return null;
}

const EMPTY_FORM = { name: "", frequency: "DAILY" as Frequency };

export function HabitsList({
  areaId,
  initialHabits,
}: {
  areaId: string;
  initialHabits: HabitWithCheckIns[];
}) {
  const [habits, setHabits] = useState(initialHabits);
  const [form, setForm] = useState(EMPTY_FORM);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  // A toggle can now be in flight for over a second across withRetry's
  // backoff — block re-entrant clicks on the same habit so a slow, later-
  // reverting first request can't clobber a second toggle's optimistic state.
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  // Which habit, if any, just got a fresh check-in and should show the
  // "add a thought?" prompt — never shown on turning a check-in back off.
  const [promptHabitId, setPromptHabitId] = useState<string | null>(null);
  const { notifyError, notifyUndo } = useToast();

  function withPending(id: string, fn: () => Promise<void>): () => void {
    return () => {
      if (pendingIds.has(id)) return;
      setPendingIds((prev) => new Set(prev).add(id));
      fn().finally(() => {
        setPendingIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      });
    };
  }

  async function handleAdd() {
    if (!form.name.trim()) {
      setError("Name is required.");
      return;
    }
    setAdding(true);
    setError(null);
    const result = await withRetry(() => createHabit(areaId, form.name, form.frequency));
    setAdding(false);
    if (!result.ok) {
      setError(result.error);
      notifyError(result.error, { onRetry: handleAdd });
      return;
    }
    setHabits((prev) => [...prev, { ...result.habit, checkInDates: [], todayLevel: null }]);
    setForm(EMPTY_FORM);
  }

  async function handleToggleCheckIn(habit: HabitWithCheckIns) {
    const newLevel = nextLevel(habit.todayLevel);
    const todayDate = utcMidnight(new Date());

    setHabits((prev) =>
      prev.map((h) => {
        if (h.id !== habit.id) return h;
        let checkInDates = h.checkInDates;
        if (habit.todayLevel === null && newLevel !== null) {
          checkInDates = [...h.checkInDates, todayDate];
        } else if (habit.todayLevel !== null && newLevel === null) {
          checkInDates = h.checkInDates.filter((d) => d.getTime() !== todayDate.getTime());
        }
        return { ...h, todayLevel: newLevel, checkInDates };
      })
    );

    const result = await withRetry(() => cycleTodayCheckIn(habit.id));
    if (!result.ok) {
      // Revert on failure.
      setHabits((prev) => prev.map((h) => (h.id === habit.id ? habit : h)));
      setError(result.error);
      notifyError(result.error, { onRetry: () => handleToggleCheckIn(habit) });
      return;
    }
    if (habit.todayLevel === null && newLevel !== null) {
      setPromptHabitId(habit.id);
    }
  }

  async function handleToggleActive(habit: HabitWithCheckIns) {
    setHabits((prev) => prev.map((h) => (h.id === habit.id ? { ...h, active: !h.active } : h)));
    const result = await withRetry(() => setHabitActive(habit.id, !habit.active));
    if (!result.ok) {
      setHabits((prev) => prev.map((h) => (h.id === habit.id ? habit : h)));
      setError(result.error);
      notifyError(result.error, { onRetry: () => handleToggleActive(habit) });
    }
  }

  async function handleDelete(habit: HabitWithCheckIns) {
    setHabits((prev) => prev.filter((h) => h.id !== habit.id));
    const result = await withRetry(() => deleteHabit(habit.id));
    if (!result.ok) {
      setHabits((prev) => [...prev, habit]);
      setError(result.error);
      notifyError(result.error, { onRetry: () => handleDelete(habit) });
      return;
    }
    const deleted = result.deleted;
    notifyUndo(`Deleted "${habit.name}".`, () => handleUndoDelete(deleted), UNDO_WINDOW_MS);
  }

  async function handleUndoDelete(deleted: DeletedHabit) {
    const result = await withRetry(() => restoreHabit(deleted));
    if (!result.ok) {
      setError(result.error);
      notifyError(result.error, { onRetry: () => handleUndoDelete(deleted) });
      return;
    }
    setHabits((prev) => [
      ...prev,
      {
        id: deleted.id,
        areaId: deleted.areaId,
        name: deleted.name,
        frequency: deleted.frequency,
        active: deleted.active,
        checkInDates: deleted.checkIns.map((c) => c.date),
        todayLevel:
          deleted.checkIns.find((c) => c.date.getTime() === utcMidnight(new Date()).getTime())?.level ?? null,
      },
    ]);
  }

  return (
    <div>
      <ul className={styles.list}>
        {habits.map((habit) =>
          editingId === habit.id ? (
            <HabitEditRow
              key={habit.id}
              habit={habit}
              onCancel={() => setEditingId(null)}
              onSaved={(name, frequency) => {
                setHabits((prev) =>
                  prev.map((h) => (h.id === habit.id ? { ...h, name, frequency } : h))
                );
                setEditingId(null);
              }}
            />
          ) : (
            <li key={habit.id} className={`${styles.row} ${!habit.active ? styles.inactive : ""}`}>
              <div>
                <div className={styles.name}>{habit.name}</div>
                {habit.active ? (
                  <div className={styles.meta}>
                    {habit.frequency === "DAILY" ? "Daily" : "Weekly"} · {streakFor(habit)}{" "}
                    {habit.frequency === "DAILY" ? "day" : "week"} streak
                    {isEstablished(streakFor(habit), habit.frequency) && (
                      <span className={styles.established}>Established</span>
                    )}
                  </div>
                ) : (
                  <div className={styles.meta}>Inactive</div>
                )}
              </div>
              <div className={styles.rowActions}>
                {habit.active && (
                  <button
                    type="button"
                    className={`${styles.dot} ${styles[habit.todayLevel?.toLowerCase() ?? "none"]}`}
                    aria-label={`Check in: currently ${habit.todayLevel ?? "not checked in"}`}
                    disabled={pendingIds.has(habit.id)}
                    onClick={withPending(habit.id, () => handleToggleCheckIn(habit))}
                  />
                )}
                <button
                  type="button"
                  className={styles.link}
                  disabled={pendingIds.has(habit.id)}
                  onClick={withPending(habit.id, () => handleToggleActive(habit))}
                >
                  {habit.active ? "Deactivate" : "Activate"}
                </button>
                <button type="button" className={styles.link} onClick={() => setEditingId(habit.id)}>
                  Edit
                </button>
                <button type="button" className={styles.link} onClick={() => handleDelete(habit)}>
                  Delete
                </button>
              </div>
              {promptHabitId === habit.id && (
                <ThoughtPrompt areaId={areaId} onDone={() => setPromptHabitId(null)} />
              )}
            </li>
          )
        )}
        {habits.length === 0 && <li className={styles.empty}>No habits yet.</li>}
      </ul>

      <div className={styles.addForm}>
        <input
          className={styles.input}
          placeholder="Habit name"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        />
        <select
          className={styles.input}
          value={form.frequency}
          onChange={(e) => setForm((f) => ({ ...f, frequency: e.target.value as Frequency }))}
        >
          <option value="DAILY">Daily</option>
          <option value="WEEKLY">Weekly</option>
        </select>
        <button type="button" className={styles.add} onClick={handleAdd} disabled={adding}>
          {adding ? "Adding…" : "Add habit"}
        </button>
      </div>
      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}

function HabitEditRow({
  habit,
  onCancel,
  onSaved,
}: {
  habit: HabitWithCheckIns;
  onCancel: () => void;
  onSaved: (name: string, frequency: Frequency) => void;
}) {
  const [name, setName] = useState(habit.name);
  const [frequency, setFrequency] = useState<Frequency>(habit.frequency);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { notifyError } = useToast();

  async function handleSave() {
    setSaving(true);
    setError(null);
    const result = await withRetry(() => updateHabit(habit.id, name, frequency));
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      notifyError(result.error, { onRetry: handleSave });
      return;
    }
    onSaved(name, frequency);
  }

  return (
    <li className={styles.addForm}>
      <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} />
      <select
        className={styles.input}
        value={frequency}
        onChange={(e) => setFrequency(e.target.value as Frequency)}
      >
        <option value="DAILY">Daily</option>
        <option value="WEEKLY">Weekly</option>
      </select>
      <button type="button" className={styles.add} onClick={handleSave} disabled={saving}>
        {saving ? "Saving…" : "Save"}
      </button>
      <button type="button" className={styles.link} onClick={onCancel}>
        Cancel
      </button>
      {error && <p className={styles.error}>{error}</p>}
    </li>
  );
}

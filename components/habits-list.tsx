"use client";

import { useState } from "react";
import Link from "next/link";
import { dailyStreak, weeklyStreak, isEstablished } from "@/lib/habits/streak";
import { formatScheduleLabel, type HabitScheduleType } from "@/lib/habits/schedule";
import {
  createHabit,
  updateHabit,
  deleteHabit,
  restoreHabit,
  setHabitStatus,
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
type HabitStatus = "ACTIVE" | "PAUSED" | "ARCHIVED";

const QUICK_SCHEDULES: HabitScheduleType[] = ["DAILY", "WEEKDAYS", "WEEKLY", "MONTHLY"];

export type AreaHabit = {
  id: string;
  areaId: string | null;
  pillarId: string;
  name: string;
  status: HabitStatus;
  scheduleType: HabitScheduleType;
  scheduleWeekdays: number[];
  scheduleIntervalN: number | null;
  checkInDates: Date[];
  todayLevel: CheckInLevel;
};

function streakFor(habit: AreaHabit): number {
  return habit.scheduleType === "WEEKLY" ? weeklyStreak(habit.checkInDates) : dailyStreak(habit.checkInDates);
}

function nextLevel(level: CheckInLevel): CheckInLevel {
  if (level === null) return "FULL";
  if (level === "FULL") return "MINIMUM";
  return null;
}

const EMPTY_FORM = { name: "", scheduleType: "DAILY" as HabitScheduleType };

export function HabitsList({
  areaId,
  pillarId,
  initialHabits,
}: {
  areaId: string;
  pillarId: string;
  initialHabits: AreaHabit[];
}) {
  const [habits, setHabits] = useState(initialHabits);
  const [form, setForm] = useState(EMPTY_FORM);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
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
    const result = await withRetry(() =>
      createHabit({
        name: form.name,
        pillarId,
        areaId,
        schedule: { scheduleType: form.scheduleType, scheduleWeekdays: [], scheduleIntervalN: null },
        goalIds: [],
        primaryGoalId: null,
      })
    );
    setAdding(false);
    if (!result.ok) {
      setError(result.error);
      notifyError(result.error, { onRetry: handleAdd });
      return;
    }
    setHabits((prev) => [
      ...prev,
      {
        id: result.id,
        areaId,
        pillarId,
        name: form.name,
        status: "PAUSED",
        scheduleType: form.scheduleType,
        scheduleWeekdays: [],
        scheduleIntervalN: null,
        checkInDates: [],
        todayLevel: null,
      },
    ]);
    setForm(EMPTY_FORM);
  }

  async function handleToggleCheckIn(habit: AreaHabit) {
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
      setHabits((prev) => prev.map((h) => (h.id === habit.id ? habit : h)));
      setError(result.error);
      notifyError(result.error, { onRetry: () => handleToggleCheckIn(habit) });
      return;
    }
    if (habit.todayLevel === null && newLevel !== null) {
      setPromptHabitId(habit.id);
    }
  }

  async function handleToggleStatus(habit: AreaHabit) {
    const next = habit.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
    setHabits((prev) => prev.map((h) => (h.id === habit.id ? { ...h, status: next } : h)));
    const result = await withRetry(() => setHabitStatus(habit.id, next));
    if (!result.ok) {
      setHabits((prev) => prev.map((h) => (h.id === habit.id ? habit : h)));
      setError(result.error);
      notifyError(result.error, { onRetry: () => handleToggleStatus(habit) });
    }
  }

  async function handleDelete(habit: AreaHabit) {
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
        pillarId: deleted.pillarId,
        name: deleted.name,
        status: deleted.status,
        scheduleType: deleted.scheduleType,
        scheduleWeekdays: deleted.scheduleWeekdays,
        scheduleIntervalN: deleted.scheduleIntervalN,
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
              pillarId={pillarId}
              areaId={areaId}
              onCancel={() => setEditingId(null)}
              onSaved={(name, scheduleType) => {
                setHabits((prev) => prev.map((h) => (h.id === habit.id ? { ...h, name, scheduleType } : h)));
                setEditingId(null);
              }}
            />
          ) : (
            <li key={habit.id} className={`${styles.row} ${habit.status !== "ACTIVE" ? styles.inactive : ""}`}>
              <div>
                <div className={styles.name}>{habit.name}</div>
                {habit.status === "ACTIVE" ? (
                  <div className={styles.meta}>
                    {formatScheduleLabel({ ...habit, scheduleAnchorDate: null })} · {streakFor(habit)} day streak
                    {isEstablished(streakFor(habit), habit.scheduleType === "WEEKLY" ? "WEEKLY" : "DAILY") && (
                      <span className={styles.established}>Established</span>
                    )}
                  </div>
                ) : (
                  <div className={styles.meta}>{habit.status === "PAUSED" ? "Paused" : "Archived"}</div>
                )}
              </div>
              <div className={styles.rowActions}>
                {habit.status === "ACTIVE" && (
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
                  onClick={withPending(habit.id, () => handleToggleStatus(habit))}
                >
                  {habit.status === "ACTIVE" ? "Pause" : "Activate"}
                </button>
                <button type="button" className={styles.link} onClick={() => setEditingId(habit.id)}>
                  Edit
                </button>
                <button type="button" className={styles.link} onClick={() => handleDelete(habit)}>
                  Delete
                </button>
              </div>
              {promptHabitId === habit.id && areaId && (
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
          value={form.scheduleType}
          onChange={(e) => setForm((f) => ({ ...f, scheduleType: e.target.value as HabitScheduleType }))}
        >
          {QUICK_SCHEDULES.map((s) => (
            <option key={s} value={s}>
              {formatScheduleLabel({ scheduleType: s, scheduleWeekdays: [], scheduleIntervalN: null, scheduleAnchorDate: null })}
            </option>
          ))}
        </select>
        <button type="button" className={styles.add} onClick={handleAdd} disabled={adding}>
          {adding ? "Adding…" : "Add habit"}
        </button>
      </div>
      <p className={styles.hint}>
        More schedule options (selected weekdays, every N days/weeks, Goals) are available in{" "}
        <Link href="/habits">Habit Management</Link>.
      </p>
      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}

function HabitEditRow({
  habit,
  pillarId,
  areaId,
  onCancel,
  onSaved,
}: {
  habit: AreaHabit;
  pillarId: string;
  areaId: string;
  onCancel: () => void;
  onSaved: (name: string, scheduleType: HabitScheduleType) => void;
}) {
  const [name, setName] = useState(habit.name);
  const [scheduleType, setScheduleType] = useState<HabitScheduleType>(habit.scheduleType);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { notifyError } = useToast();

  async function handleSave() {
    setSaving(true);
    setError(null);
    const result = await withRetry(() =>
      updateHabit(habit.id, {
        name,
        pillarId,
        areaId,
        schedule: { scheduleType, scheduleWeekdays: habit.scheduleWeekdays, scheduleIntervalN: habit.scheduleIntervalN },
        goalIds: [],
        primaryGoalId: null,
      })
    );
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      notifyError(result.error, { onRetry: handleSave });
      return;
    }
    onSaved(name, scheduleType);
  }

  return (
    <li className={styles.addForm}>
      <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} />
      <select className={styles.input} value={scheduleType} onChange={(e) => setScheduleType(e.target.value as HabitScheduleType)}>
        {QUICK_SCHEDULES.map((s) => (
          <option key={s} value={s}>
            {formatScheduleLabel({ scheduleType: s, scheduleWeekdays: [], scheduleIntervalN: null, scheduleAnchorDate: null })}
          </option>
        ))}
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

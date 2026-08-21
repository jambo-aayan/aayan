"use client";

import { useState } from "react";
import { Plus, Repeat } from "lucide-react";
import { PrimaryButton } from "@/components/primary-button";
import { HabitComposer, type HabitFormInput } from "./habit-composer";
import { useToast } from "@/components/toast/toast-provider";
import { withRetry } from "@/lib/with-retry";
import {
  createHabit,
  updateHabit,
  deleteHabit,
  restoreHabit,
  setHabitStatus,
  cycleTodayCheckIn,
  type DeletedHabit,
} from "@/lib/habits/actions";
import { formatScheduleLabel } from "@/lib/habits/schedule";
import { dailyStreak, weeklyStreak } from "@/lib/habits/streak";
import { nextCheckInLevel } from "@/lib/habits/check-in";
import { resolveColorHex, type ColorKey } from "@/lib/colors";
import { HabitDot } from "@/components/habit-dot";
import { TaskMenu } from "@/components/tasks/task-menu";
import type { HabitWithRelations } from "@/lib/habits/data";
import styles from "./habit-manager.module.css";

const STATUS_LABEL: Record<string, string> = { ACTIVE: "Active", PAUSED: "Paused", ARCHIVED: "Archived" };
const UNDO_WINDOW_MS = 5000;

function streakFor(habit: HabitWithRelations): number {
  return habit.scheduleType === "WEEKLY" ? weeklyStreak(habit.checkInDates) : dailyStreak(habit.checkInDates);
}

export function HabitManager({
  habits: initialHabits,
  pillars,
  areas,
  goals,
  emptyMessage,
}: {
  habits: HabitWithRelations[];
  pillars: { id: string; name: string; color?: string | null }[];
  areas: { id: string; name: string; pillarId: string }[];
  goals: { id: string; name: string; pillarId: string }[];
  emptyMessage: string;
}) {
  const [habits, setHabits] = useState(initialHabits);
  const [composer, setComposer] = useState<{ mode: "create" | "edit"; habit?: HabitWithRelations } | null>(null);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const { notifyError, notifyUndo } = useToast();

  async function handleToggleCheckIn(habit: HabitWithRelations) {
    if (pendingIds.has(habit.id)) return;
    setPendingIds((prev) => new Set(prev).add(habit.id));
    const newLevel = nextCheckInLevel(habit.todayLevel);
    setHabits((prev) => prev.map((h) => (h.id === habit.id ? { ...h, todayLevel: newLevel } : h)));

    const result = await withRetry(() => cycleTodayCheckIn(habit.id));
    setPendingIds((prev) => {
      const next = new Set(prev);
      next.delete(habit.id);
      return next;
    });
    if (!result.ok) {
      setHabits((prev) => prev.map((h) => (h.id === habit.id ? habit : h)));
      notifyError(result.error, { onRetry: () => handleToggleCheckIn(habit) });
    }
  }

  async function handleStatus(habit: HabitWithRelations, status: "ACTIVE" | "PAUSED" | "ARCHIVED") {
    if (habit.status === status) return;
    const prev = habit.status;
    setHabits((p) => p.map((h) => (h.id === habit.id ? { ...h, status } : h)));
    const result = await withRetry(() => setHabitStatus(habit.id, status));
    if (!result.ok) {
      setHabits((p) => p.map((h) => (h.id === habit.id ? { ...h, status: prev } : h)));
      notifyError(result.error, { onRetry: () => handleStatus(habit, status) });
    }
  }

  async function handleDelete(habit: HabitWithRelations) {
    setHabits((p) => p.filter((h) => h.id !== habit.id));
    const result = await withRetry(() => deleteHabit(habit.id));
    if (!result.ok) {
      setHabits((p) => [...p, habit]);
      notifyError(result.error, { onRetry: () => handleDelete(habit) });
      return;
    }
    const deleted = result.deleted;
    notifyUndo(`Deleted "${habit.name}".`, () => handleUndoDelete(deleted), UNDO_WINDOW_MS);
  }

  async function handleUndoDelete(deleted: DeletedHabit) {
    const result = await withRetry(() => restoreHabit(deleted));
    if (!result.ok) {
      notifyError(result.error, { onRetry: () => handleUndoDelete(deleted) });
      return;
    }
    setHabits((prev) => [
      ...prev,
      {
        id: deleted.id,
        pillarId: deleted.pillarId,
        pillarName: pillars.find((p) => p.id === deleted.pillarId)?.name ?? "",
        pillarColor: pillars.find((p) => p.id === deleted.pillarId)?.color ?? null,
        areaId: deleted.areaId,
        areaName: areas.find((a) => a.id === deleted.areaId)?.name ?? null,
        name: deleted.name,
        status: deleted.status,
        scheduleType: deleted.scheduleType,
        scheduleWeekdays: deleted.scheduleWeekdays,
        scheduleIntervalN: deleted.scheduleIntervalN,
        scheduleAnchorDate: deleted.scheduleAnchorDate,
        scheduleCustomText: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        checkInDates: deleted.checkIns.map((c) => c.date),
        todayLevel: null,
        goals: [],
        primaryGoal: null,
      },
    ]);
  }

  async function handleComposerSubmit(input: HabitFormInput) {
    if (composer?.mode === "edit" && composer.habit) {
      const result = await updateHabit(composer.habit.id, {
        name: input.name,
        pillarId: input.pillarId,
        areaId: input.areaId,
        schedule: {
          scheduleType: input.scheduleType,
          scheduleWeekdays: input.scheduleWeekdays,
          scheduleIntervalN: input.scheduleIntervalN,
        },
        goalIds: input.goalIds,
        primaryGoalId: input.primaryGoalId,
      });
      if (result.ok) {
        setHabits((prev) =>
          prev.map((h) =>
            h.id === composer.habit!.id
              ? {
                  ...h,
                  name: input.name,
                  pillarId: input.pillarId,
                  pillarName: pillars.find((p) => p.id === input.pillarId)?.name ?? h.pillarName,
                  pillarColor: pillars.find((p) => p.id === input.pillarId)?.color ?? h.pillarColor,
                  areaId: input.areaId,
                  areaName: areas.find((a) => a.id === input.areaId)?.name ?? null,
                  scheduleType: input.scheduleType,
                  scheduleWeekdays: input.scheduleWeekdays,
                  scheduleIntervalN: input.scheduleIntervalN,
                  goals: input.goalIds.map((id) => ({
                    id,
                    name: goals.find((g) => g.id === id)?.name ?? "",
                    status: "ACTIVE",
                    isPrimary: id === input.primaryGoalId,
                  })),
                  primaryGoal: input.primaryGoalId
                    ? { id: input.primaryGoalId, name: goals.find((g) => g.id === input.primaryGoalId)?.name ?? "", status: "ACTIVE" }
                    : null,
                }
              : h
          )
        );
      }
      return result;
    }

    const result = await createHabit({
      name: input.name,
      pillarId: input.pillarId,
      areaId: input.areaId,
      schedule: {
        scheduleType: input.scheduleType,
        scheduleWeekdays: input.scheduleWeekdays,
        scheduleIntervalN: input.scheduleIntervalN,
      },
      goalIds: input.goalIds,
      primaryGoalId: input.primaryGoalId,
    });
    if (result.ok) {
      setHabits((prev) => [
        ...prev,
        {
          id: result.id,
          pillarId: input.pillarId,
          pillarName: pillars.find((p) => p.id === input.pillarId)?.name ?? "",
          pillarColor: pillars.find((p) => p.id === input.pillarId)?.color ?? null,
          areaId: input.areaId,
          areaName: areas.find((a) => a.id === input.areaId)?.name ?? null,
          name: input.name,
          status: "PAUSED",
          scheduleType: input.scheduleType,
          scheduleWeekdays: input.scheduleWeekdays,
          scheduleIntervalN: input.scheduleIntervalN,
          scheduleAnchorDate: new Date(),
          scheduleCustomText: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          checkInDates: [],
          todayLevel: null,
          goals: input.goalIds.map((id) => ({
            id,
            name: goals.find((g) => g.id === id)?.name ?? "",
            status: "ACTIVE",
            isPrimary: id === input.primaryGoalId,
          })),
          primaryGoal: input.primaryGoalId
            ? { id: input.primaryGoalId, name: goals.find((g) => g.id === input.primaryGoalId)?.name ?? "", status: "ACTIVE" }
            : null,
        },
      ]);
      return { ok: true as const };
    }
    return result;
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <PrimaryButton onClick={() => setComposer({ mode: "create" })}>
          <Plus size={14} strokeWidth={2.5} /> New habit
        </PrimaryButton>
      </div>

      {habits.length === 0 ? (
        <div className={styles.empty}>
          <Repeat size={22} strokeWidth={1.6} />
          <p>{emptyMessage}</p>
        </div>
      ) : (
        <ul className={styles.list}>
          {habits.map((habit) => {
            const hex = resolveColorHex(habit.pillarColor as ColorKey | null);
            return (
              <li key={habit.id} className={`${styles.row} ${habit.status === "ARCHIVED" ? styles.archived : ""}`}>
                <div className={styles.top}>
                  {habit.status === "ACTIVE" && (
                    <HabitDot
                      level={habit.todayLevel}
                      accentColor={hex}
                      size={20}
                      label={`Check in "${habit.name}": currently ${habit.todayLevel ?? "not checked in"}`}
                      onToggle={() => handleToggleCheckIn(habit)}
                    />
                  )}
                  <button type="button" className={styles.main} onClick={() => setComposer({ mode: "edit", habit })}>
                    <div className={styles.name}>{habit.name}</div>
                    <div className={styles.meta}>
                      <span className={styles.pill} style={{ background: hex ? `${hex}22` : "var(--bg2)", color: hex ?? "var(--muted)" }}>
                        {habit.pillarName}
                      </span>
                      {habit.areaName && <span className={styles.pillMuted}>{habit.areaName}</span>}
                      <span className={styles.scheduleChip}>{formatScheduleLabel(habit)}</span>
                      {habit.status === "ACTIVE" && <span className={styles.pillMuted}>{streakFor(habit)} day streak</span>}
                      {habit.goals.map((g) => (
                        <span key={g.id} className={styles.goalPill}>
                          {g.isPrimary ? "★ " : ""}
                          {g.name}
                        </span>
                      ))}
                    </div>
                  </button>
                </div>
                <div className={styles.actions}>
                  <div className={styles.statusGroup} role="group" aria-label="Status">
                    {(["ACTIVE", "PAUSED", "ARCHIVED"] as const).map((s) => (
                      <button
                        key={s}
                        type="button"
                        className={`${styles.statusBtn} ${habit.status === s ? styles.statusBtnActive : ""}`}
                        onClick={() => handleStatus(habit, s)}
                      >
                        {STATUS_LABEL[s]}
                      </button>
                    ))}
                  </div>
                  <TaskMenu
                    items={[{ label: "Delete", onSelect: () => handleDelete(habit), danger: true }]}
                    label="Habit options"
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {composer && (
        <HabitComposer
          mode={composer.mode}
          habit={composer.habit}
          pillars={pillars}
          areas={areas}
          goals={goals}
          onClose={() => setComposer(null)}
          onSubmit={handleComposerSubmit}
        />
      )}
    </div>
  );
}

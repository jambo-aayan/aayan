"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { todayUtcMidnight } from "./today";
import type { HabitScheduleType } from "./schedule";

export type ActionResult = { ok: true } | { ok: false; error: string };

const SAVE_ERROR = "Couldn't save — try again.";

function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

function revalidateHabitPaths(areaId: string | null, pillarId: string) {
  if (areaId) revalidatePath(`/health/${areaId}`);
  revalidatePath("/habits");
  revalidatePath("/today");
  revalidatePath(`/pillars/${pillarId}`);
}

export type HabitScheduleInput = {
  scheduleType: HabitScheduleType;
  scheduleWeekdays: number[];
  scheduleIntervalN: number | null;
};

export type CreateHabitInput = {
  name: string;
  pillarId: string;
  areaId: string | null;
  schedule: HabitScheduleInput;
  goalIds: string[];
  primaryGoalId: string | null;
};

export type CreateHabitResult = { ok: true; id: string } | { ok: false; error: string };

/** Every interval-based schedule (EVERY_N_DAYS/EVERY_N_WEEKS) and MONTHLY
 * anchors on the creation date — the day the user set the schedule up is a
 * sensible, unsurprising start point, and it's editable later by recreating
 * the schedule if the user wants a different anchor. */
export async function createHabit(input: CreateHabitInput): Promise<CreateHabitResult> {
  const name = input.name.trim();
  if (!name) return { ok: false, error: "Give the habit a name first." };

  try {
    const habit = await prisma.habit.create({
      data: {
        name,
        pillarId: input.pillarId,
        areaId: input.areaId,
        status: "PAUSED",
        scheduleType: input.schedule.scheduleType,
        scheduleWeekdays: input.schedule.scheduleWeekdays,
        scheduleIntervalN: input.schedule.scheduleIntervalN,
        scheduleAnchorDate: todayUtcMidnight(),
        goals: {
          create: input.goalIds.map((goalId) => ({ goalId, isPrimary: goalId === input.primaryGoalId })),
        },
      },
    });
    revalidateHabitPaths(input.areaId, input.pillarId);
    return { ok: true, id: habit.id };
  } catch {
    return { ok: false, error: SAVE_ERROR };
  }
}

export type UpdateHabitInput = CreateHabitInput;

export async function updateHabit(habitId: string, input: UpdateHabitInput): Promise<ActionResult> {
  const name = input.name.trim();
  if (!name) return { ok: false, error: "Give the habit a name first." };

  try {
    await prisma.$transaction([
      prisma.habitGoal.deleteMany({ where: { habitId } }),
      prisma.habit.update({
        where: { id: habitId },
        data: {
          name,
          pillarId: input.pillarId,
          areaId: input.areaId,
          scheduleType: input.schedule.scheduleType,
          scheduleWeekdays: input.schedule.scheduleWeekdays,
          scheduleIntervalN: input.schedule.scheduleIntervalN,
          goals: {
            create: input.goalIds.map((goalId) => ({ goalId, isPrimary: goalId === input.primaryGoalId })),
          },
        },
      }),
    ]);
  } catch {
    return { ok: false, error: SAVE_ERROR };
  }
  revalidateHabitPaths(input.areaId, input.pillarId);
  return { ok: true };
}

export type DeletedHabit = {
  id: string;
  name: string;
  pillarId: string;
  areaId: string | null;
  status: "ACTIVE" | "PAUSED" | "ARCHIVED";
  scheduleType: HabitScheduleType;
  scheduleWeekdays: number[];
  scheduleIntervalN: number | null;
  scheduleTargetCount: number | null;
  scheduleAnchorDate: Date | null;
  checkIns: { date: Date; level: "FULL" | "MINIMUM" }[];
};

export type DeleteHabitResult = { ok: true; deleted: DeletedHabit } | { ok: false; error: string };

/**
 * CheckIn rows reference their Habit with ON DELETE RESTRICT, so a delete-undo
 * toast needs the full set of check-ins removed alongside the habit — both to
 * satisfy the FK and so `restoreHabit` can put everything back exactly.
 */
export async function deleteHabit(habitId: string): Promise<DeleteHabitResult> {
  let result;
  try {
    result = await prisma.$transaction(async (tx) => {
      const checkIns = await tx.checkIn.findMany({ where: { habitId } });
      await tx.checkIn.deleteMany({ where: { habitId } });
      const habit = await tx.habit.delete({ where: { id: habitId } });
      return { habit, checkIns };
    });
  } catch {
    return { ok: false, error: "Couldn't delete — try again." };
  }
  revalidateHabitPaths(result.habit.areaId, result.habit.pillarId);
  return {
    ok: true,
    deleted: {
      id: result.habit.id,
      name: result.habit.name,
      pillarId: result.habit.pillarId,
      areaId: result.habit.areaId,
      status: result.habit.status,
      scheduleType: result.habit.scheduleType,
      scheduleWeekdays: result.habit.scheduleWeekdays,
      scheduleIntervalN: result.habit.scheduleIntervalN,
      scheduleTargetCount: result.habit.scheduleTargetCount,
      scheduleAnchorDate: result.habit.scheduleAnchorDate,
      checkIns: result.checkIns.map((c) => ({ date: c.date, level: c.level })),
    },
  };
}

/** Recreates a just-deleted habit and its check-ins, for the delete-undo toast. */
export async function restoreHabit(deleted: DeletedHabit): Promise<ActionResult> {
  try {
    await prisma.$transaction(async (tx) => {
      await tx.habit.create({
        data: {
          id: deleted.id,
          name: deleted.name,
          pillarId: deleted.pillarId,
          areaId: deleted.areaId,
          status: deleted.status,
          scheduleType: deleted.scheduleType,
          scheduleWeekdays: deleted.scheduleWeekdays,
          scheduleIntervalN: deleted.scheduleIntervalN,
          scheduleTargetCount: deleted.scheduleTargetCount,
          scheduleAnchorDate: deleted.scheduleAnchorDate,
        },
      });
      if (deleted.checkIns.length > 0) {
        await tx.checkIn.createMany({
          data: deleted.checkIns.map((c) => ({ habitId: deleted.id, date: c.date, level: c.level })),
        });
      }
    });
  } catch {
    return { ok: false, error: "Couldn't undo — the habit may already be back." };
  }
  revalidateHabitPaths(deleted.areaId, deleted.pillarId);
  return { ok: true };
}

export async function setHabitStatus(
  habitId: string,
  status: "ACTIVE" | "PAUSED" | "ARCHIVED"
): Promise<ActionResult> {
  let habit;
  try {
    habit = await prisma.habit.update({ where: { id: habitId }, data: { status } });
  } catch {
    return { ok: false, error: SAVE_ERROR };
  }
  revalidateHabitPaths(habit.areaId, habit.pillarId);
  return { ok: true };
}

/**
 * Cycles today's check-in: no row -> FULL -> MINIMUM -> no row.
 * A concurrent double-tap can race two reads that both see "no row" and
 * both try to create one; the second create hits the (habitId, date)
 * unique constraint. That's retried once — by then the row exists, so the
 * retry takes the FULL -> MINIMUM branch instead, completing the cycle
 * correctly rather than surfacing a spurious save error.
 */
export async function cycleTodayCheckIn(habitId: string): Promise<ActionResult> {
  const date = todayUtcMidnight();
  let areaId: string | null;
  let pillarId: string;

  try {
    const habit = await prisma.habit.findUniqueOrThrow({ where: { id: habitId } });
    areaId = habit.areaId;
    pillarId = habit.pillarId;

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const existing = await prisma.checkIn.findUnique({ where: { habitId_date: { habitId, date } } });

        if (!existing) {
          await prisma.checkIn.create({ data: { habitId, date, level: "FULL" } });
        } else if (existing.level === "FULL") {
          await prisma.checkIn.update({ where: { id: existing.id }, data: { level: "MINIMUM" } });
        } else {
          await prisma.checkIn.delete({ where: { id: existing.id } });
        }
        break;
      } catch (error) {
        if (attempt === 0 && isUniqueConstraintError(error)) continue;
        throw error;
      }
    }
  } catch {
    return { ok: false, error: SAVE_ERROR };
  }

  revalidateHabitPaths(areaId, pillarId);
  return { ok: true };
}

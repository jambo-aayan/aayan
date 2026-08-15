"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { todayUtcMidnight } from "./today";
import type { Frequency } from "./streak";

export type ActionResult = { ok: true } | { ok: false; error: string };

export type CreateHabitResult =
  | { ok: true; habit: { id: string; areaId: string; name: string; frequency: Frequency; active: boolean } }
  | { ok: false; error: string };

const SAVE_ERROR = "Couldn't save — try again.";

function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

export async function createHabit(
  areaId: string,
  name: string,
  frequency: Frequency
): Promise<CreateHabitResult> {
  let habit;
  try {
    habit = await prisma.habit.create({ data: { areaId, name, frequency, active: false } });
  } catch {
    return { ok: false, error: SAVE_ERROR };
  }
  revalidatePath(`/health/${areaId}`);
  return { ok: true, habit };
}

export async function updateHabit(
  habitId: string,
  name: string,
  frequency: Frequency
): Promise<ActionResult> {
  let habit;
  try {
    habit = await prisma.habit.update({ where: { id: habitId }, data: { name, frequency } });
  } catch {
    return { ok: false, error: SAVE_ERROR };
  }
  revalidatePath(`/health/${habit.areaId}`);
  return { ok: true };
}

export async function deleteHabit(habitId: string): Promise<ActionResult> {
  let habit;
  try {
    habit = await prisma.habit.delete({ where: { id: habitId } });
  } catch {
    return { ok: false, error: "Couldn't delete — try again." };
  }
  revalidatePath(`/health/${habit.areaId}`);
  return { ok: true };
}

export async function setHabitActive(habitId: string, active: boolean): Promise<ActionResult> {
  let habit;
  try {
    habit = await prisma.habit.update({ where: { id: habitId }, data: { active } });
  } catch {
    return { ok: false, error: SAVE_ERROR };
  }
  revalidatePath(`/health/${habit.areaId}`);
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
  let areaId: string;

  try {
    const habit = await prisma.habit.findUniqueOrThrow({ where: { id: habitId } });
    areaId = habit.areaId;

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

  revalidatePath(`/health/${areaId}`);
  return { ok: true };
}

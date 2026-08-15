"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { todayUtcMidnight } from "./today";

export type ActionResult = { ok: true } | { ok: false; error: string };

export type CreateHabitResult =
  | { ok: true; habit: { id: string; areaId: string; name: string; frequency: "DAILY" | "WEEKLY"; active: boolean } }
  | { ok: false; error: string };

const SAVE_ERROR = "Couldn't save — try again.";

export async function createHabit(
  areaId: string,
  name: string,
  frequency: "DAILY" | "WEEKLY"
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
  areaId: string,
  name: string,
  frequency: "DAILY" | "WEEKLY"
): Promise<ActionResult> {
  try {
    await prisma.habit.update({ where: { id: habitId }, data: { name, frequency } });
  } catch {
    return { ok: false, error: SAVE_ERROR };
  }
  revalidatePath(`/health/${areaId}`);
  return { ok: true };
}

export async function deleteHabit(habitId: string, areaId: string): Promise<ActionResult> {
  try {
    await prisma.habit.delete({ where: { id: habitId } });
  } catch {
    return { ok: false, error: "Couldn't delete — try again." };
  }
  revalidatePath(`/health/${areaId}`);
  return { ok: true };
}

export async function setHabitActive(
  habitId: string,
  areaId: string,
  active: boolean
): Promise<ActionResult> {
  try {
    await prisma.habit.update({ where: { id: habitId }, data: { active } });
  } catch {
    return { ok: false, error: SAVE_ERROR };
  }
  revalidatePath(`/health/${areaId}`);
  return { ok: true };
}

/** Cycles today's check-in: no row -> FULL -> MINIMUM -> no row. */
export async function cycleTodayCheckIn(habitId: string, areaId: string): Promise<ActionResult> {
  const date = todayUtcMidnight();
  try {
    const existing = await prisma.checkIn.findUnique({
      where: { habitId_date: { habitId, date } },
    });

    if (!existing) {
      await prisma.checkIn.create({ data: { habitId, date, level: "FULL" } });
    } else if (existing.level === "FULL") {
      await prisma.checkIn.update({ where: { id: existing.id }, data: { level: "MINIMUM" } });
    } else {
      await prisma.checkIn.delete({ where: { id: existing.id } });
    }
  } catch {
    return { ok: false, error: SAVE_ERROR };
  }
  revalidatePath(`/health/${areaId}`);
  return { ok: true };
}

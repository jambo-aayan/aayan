"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export type LogInput = { date: Date; pain: number; mobility: number };

export type ActionResult = { ok: true } | { ok: false; error: string };
export type LogResult =
  | { ok: true; item: LogInput & { id: string; areaId: string } }
  | { ok: false; error: string };

function isValidScore(n: number): boolean {
  return Number.isInteger(n) && n >= 0 && n <= 10;
}

/** One log per (area, date) — logging the same date again overwrites that day's scores. */
export async function logPainMobility(areaId: string, input: LogInput): Promise<LogResult> {
  if (!isValidScore(input.pain) || !isValidScore(input.mobility)) {
    return { ok: false, error: "Scores must be whole numbers from 0 to 10." };
  }
  let log;
  try {
    log = await prisma.painMobilityLog.upsert({
      where: { areaId_date: { areaId, date: input.date } },
      create: { areaId, ...input },
      update: input,
    });
  } catch {
    return { ok: false, error: "Couldn't save — try again." };
  }
  revalidatePath(`/health/${areaId}`);
  return { ok: true, item: { ...input, id: log.id, areaId } };
}

export async function deletePainMobilityLog(id: string, areaId: string): Promise<ActionResult> {
  try {
    await prisma.painMobilityLog.delete({ where: { id } });
  } catch {
    return { ok: false, error: "Couldn't delete — try again." };
  }
  revalidatePath(`/health/${areaId}`);
  return { ok: true };
}

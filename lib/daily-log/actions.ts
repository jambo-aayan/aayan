"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { utcMidnight } from "@/lib/habits/date-utils";
import { validateDailyLogInput, stiffnessMidpoint, applyHeadacheTap, type DailyLogInput, type HeadacheLevel } from "./logic";

/** Echoes back the actually-persisted headache value — day's-worst folding
 * happens server-side against whatever's already stored, so a concurrent
 * save from another tab/session could have raised it beyond what this
 * client's own optimistic state assumed. Callers reconcile their local
 * state to this rather than trusting their own submitted value. */
export type SaveDailyLogResult = { ok: true; headache: HeadacheLevel } | { ok: false; error: string };

const SAVE_ERROR = "Couldn't save — try again.";

/**
 * Upserts today's (or any date's) DailyLog row. Headache is folded through
 * applyHeadacheTap against whatever's already stored for that date, so a
 * lower tap later in the day never overwrites a worse value already logged
 * (see lib/daily-log/logic.ts). mobility/trained are never part of the
 * input — they're derived fresh from CheckIn data at save time and are not
 * stored (see lib/daily-log/data.ts's getDerivedStateFields); this action
 * doesn't write them anywhere, callers read them separately via
 * getDerivedStateFields when displaying a day's entry.
 */
export async function saveDailyLog(date: Date, input: DailyLogInput): Promise<SaveDailyLogResult> {
  const validation = validateDailyLogInput(input);
  if (!validation.ok) return validation;

  const day = utcMidnight(date);
  const stiffness = stiffnessMidpoint(input.stiffnessBucket!);
  let headache: HeadacheLevel;

  try {
    const existing = await prisma.dailyLog.findUnique({ where: { date: day }, select: { headache: true } });
    headache = existing ? applyHeadacheTap(existing.headache, input.headache) : input.headache;

    const data = {
      mood: input.mood,
      stress: input.stress,
      energy: input.energy,
      sleepQuality: input.sleepQuality,
      pain: input.pain,
      headache,
      stiffness,
      weight: input.weight,
      waist: input.waist,
      bpSystolic: input.bpSystolic,
      bpDiastolic: input.bpDiastolic,
    };

    await prisma.dailyLog.upsert({
      where: { date: day },
      create: { date: day, ...data },
      update: data,
    });
  } catch {
    return { ok: false, error: SAVE_ERROR };
  }

  revalidatePath("/log-today");
  return { ok: true, headache };
}

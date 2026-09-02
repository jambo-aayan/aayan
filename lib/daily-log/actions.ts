"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { utcMidnight } from "@/lib/habits/date-utils";
import { validateDailyLogInput, stiffnessMidpoint, applyHeadacheTap, type DailyLogInput, type HeadacheLevel } from "./logic";
import {
  METRIC_MOOD_ID,
  METRIC_STRESS_ID,
  METRIC_ENERGY_ID,
  METRIC_SLEEP_QUALITY_ID,
  METRIC_PAIN_ID,
  METRIC_HEADACHE_ID,
  METRIC_STIFFNESS_ID,
  METRIC_WEIGHT_ID,
  METRIC_WAIST_ID,
  METRIC_BP_SYSTOLIC_ID,
  METRIC_BP_DIASTOLIC_ID,
} from "@/lib/metrics/seeded-ids";

/** Transitional shim (#182) — see data.ts's own doc comment. Writes go to
 * MetricEntry against the fixed seeded-metric ids instead of the
 * (now-dropped) DailyLog table. */

export type SaveDailyLogResult = { ok: true; headache: HeadacheLevel } | { ok: false; error: string };

const SAVE_ERROR = "Couldn't save — try again.";

function upsertEntry(metricId: string, date: Date, numberValue: number | null, textValue: string | null) {
  return prisma.metricEntry.upsert({
    where: { metricId_date: { metricId, date } },
    create: { metricId, date, numberValue, textValue },
    update: { numberValue, textValue },
  });
}

/**
 * Upserts today's (or any date's) 11 seeded-metric entries as one batch —
 * the same "one sheet, all core fields together" shape the old DailyLog
 * upsert had. Headache is folded through applyHeadacheTap against
 * whatever's already stored for that date, so a lower tap later in the day
 * never overwrites a worse value already logged (see lib/daily-log/logic.ts).
 * mobility/trained are never part of the input — unchanged, see data.ts's
 * getDerivedStateFields.
 */
export async function saveDailyLog(date: Date, input: DailyLogInput): Promise<SaveDailyLogResult> {
  const validation = validateDailyLogInput(input);
  if (!validation.ok) return validation;

  const day = utcMidnight(date);
  const stiffness = stiffnessMidpoint(input.stiffnessBucket!);
  let headache: HeadacheLevel;

  try {
    const existing = await prisma.metricEntry.findUnique({
      where: { metricId_date: { metricId: METRIC_HEADACHE_ID, date: day } },
      select: { textValue: true },
    });
    headache = existing?.textValue ? applyHeadacheTap(existing.textValue as HeadacheLevel, input.headache) : input.headache;

    await Promise.all([
      upsertEntry(METRIC_MOOD_ID, day, input.mood, null),
      upsertEntry(METRIC_STRESS_ID, day, input.stress, null),
      upsertEntry(METRIC_ENERGY_ID, day, input.energy, null),
      upsertEntry(METRIC_SLEEP_QUALITY_ID, day, input.sleepQuality, null),
      upsertEntry(METRIC_PAIN_ID, day, input.pain, null),
      upsertEntry(METRIC_HEADACHE_ID, day, null, headache),
      upsertEntry(METRIC_STIFFNESS_ID, day, stiffness, null),
      upsertEntry(METRIC_WEIGHT_ID, day, input.weight, null),
      upsertEntry(METRIC_WAIST_ID, day, input.waist, null),
      upsertEntry(METRIC_BP_SYSTOLIC_ID, day, input.bpSystolic, null),
      upsertEntry(METRIC_BP_DIASTOLIC_ID, day, input.bpDiastolic, null),
    ]);
  } catch {
    return { ok: false, error: SAVE_ERROR };
  }

  revalidatePath("/log-today");
  return { ok: true, headache };
}

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


/**
 * Upserts today's (or any date's) 11 seeded-metric entries as one batch —
 * the same "one sheet, all core fields together" shape the old DailyLog
 * upsert had, including its atomicity: all 11 upserts run inside one
 * $transaction, same as the single-row upsert it replaces, so a failure
 * partway through can never leave a day half-saved. Headache is folded
 * through applyHeadacheTap against whatever's already stored for that
 * date, so a lower tap later in the day never overwrites a worse value
 * already logged (see lib/daily-log/logic.ts). mobility/trained are never
 * part of the input — unchanged, see data.ts's getDerivedStateFields.
 */
export async function saveDailyLog(date: Date, input: DailyLogInput): Promise<SaveDailyLogResult> {
  const validation = validateDailyLogInput(input);
  if (!validation.ok) return validation;

  const day = utcMidnight(date);
  const stiffness = stiffnessMidpoint(input.stiffnessBucket!);
  let headache: HeadacheLevel;

  try {
    headache = await prisma.$transaction(async (tx) => {
      const existing = await tx.metricEntry.findUnique({
        where: { metricId_date: { metricId: METRIC_HEADACHE_ID, date: day } },
        select: { textValue: true },
      });
      const resolvedHeadache = existing?.textValue
        ? applyHeadacheTap(existing.textValue as HeadacheLevel, input.headache)
        : input.headache;

      function upsertEntry(metricId: string, numberValue: number | null, textValue: string | null) {
        return tx.metricEntry.upsert({
          where: { metricId_date: { metricId, date: day } },
          create: { metricId, date: day, numberValue, textValue },
          update: { numberValue, textValue },
        });
      }

      await Promise.all([
        upsertEntry(METRIC_MOOD_ID, input.mood, null),
        upsertEntry(METRIC_STRESS_ID, input.stress, null),
        upsertEntry(METRIC_ENERGY_ID, input.energy, null),
        upsertEntry(METRIC_SLEEP_QUALITY_ID, input.sleepQuality, null),
        upsertEntry(METRIC_PAIN_ID, input.pain, null),
        upsertEntry(METRIC_HEADACHE_ID, null, resolvedHeadache),
        upsertEntry(METRIC_STIFFNESS_ID, stiffness, null),
        upsertEntry(METRIC_WEIGHT_ID, input.weight, null),
        upsertEntry(METRIC_WAIST_ID, input.waist, null),
        upsertEntry(METRIC_BP_SYSTOLIC_ID, input.bpSystolic, null),
        upsertEntry(METRIC_BP_DIASTOLIC_ID, input.bpDiastolic, null),
      ]);

      return resolvedHeadache;
    });
  } catch {
    return { ok: false, error: SAVE_ERROR };
  }

  revalidatePath("/log-today");
  return { ok: true, headache };
}

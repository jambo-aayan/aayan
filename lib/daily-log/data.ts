import "server-only";
import { prisma } from "@/lib/prisma";
import { utcMidnight } from "@/lib/habits/date-utils";
import { STRETCH_HABIT_ID, TRAINED_HABIT_ID } from "./habit-seed";
import { stiffnessBucketFromMidpoint, type HeadacheLevel, type StiffnessBucket } from "./logic";
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

/** Transitional shim (#182) — DailyLog itself was dropped by the
 * 20260902020000_metric_system_replaces_daily_log migration in favor of
 * the generic Metric/MetricEntry system, but /log-today and its "one big
 * sheet" form still exist until #183-#188 replace them with the real
 * generic Log tab. This module keeps that old page working by reading and
 * writing MetricEntry rows against the fixed seeded-metric ids
 * (lib/metrics/seeded-ids.ts) instead, reassembling the exact same
 * DailyLogEntry shape callers already expect. Delete this whole file (and
 * the rest of lib/daily-log) once #184 lands and #188 removes the old
 * page. */

export type DailyLogEntry = {
  id: string;
  date: Date;
  mood: number;
  stress: number;
  energy: number;
  sleepQuality: number;
  pain: number;
  headache: HeadacheLevel;
  stiffness: number;
  stiffnessBucket: StiffnessBucket | null;
  weight: number | null;
  waist: number | null;
  bpSystolic: number | null;
  bpDiastolic: number | null;
};

const ALL_METRIC_IDS = [
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
];

type RawEntry = { numberValue: number | null; textValue: string | null };

/** Reassembles one DailyLogEntry from that date's MetricEntry rows. Null
 * when any of the 7 fields the old sheet always wrote together (mood,
 * stress, energy, sleep quality, pain, headache, stiffness) is missing —
 * every real migrated/saved day has all 7, per saveDailyLog below always
 * writing them as one batch, same as the old DailyLog upsert did. */
function assembleEntry(date: Date, byMetric: Map<string, RawEntry>): DailyLogEntry | null {
  const mood = byMetric.get(METRIC_MOOD_ID)?.numberValue;
  const stress = byMetric.get(METRIC_STRESS_ID)?.numberValue;
  const energy = byMetric.get(METRIC_ENERGY_ID)?.numberValue;
  const sleepQuality = byMetric.get(METRIC_SLEEP_QUALITY_ID)?.numberValue;
  const pain = byMetric.get(METRIC_PAIN_ID)?.numberValue;
  const headache = byMetric.get(METRIC_HEADACHE_ID)?.textValue as HeadacheLevel | undefined;
  const stiffness = byMetric.get(METRIC_STIFFNESS_ID)?.numberValue;
  if (mood == null || stress == null || energy == null || sleepQuality == null || pain == null || !headache || stiffness == null) {
    return null;
  }
  return {
    id: date.toISOString(),
    date,
    mood,
    stress,
    energy,
    sleepQuality,
    pain,
    headache,
    stiffness,
    stiffnessBucket: stiffnessBucketFromMidpoint(stiffness),
    weight: byMetric.get(METRIC_WEIGHT_ID)?.numberValue ?? null,
    waist: byMetric.get(METRIC_WAIST_ID)?.numberValue ?? null,
    bpSystolic: byMetric.get(METRIC_BP_SYSTOLIC_ID)?.numberValue ?? null,
    bpDiastolic: byMetric.get(METRIC_BP_DIASTOLIC_ID)?.numberValue ?? null,
  };
}

export async function getDailyLog(date: Date): Promise<DailyLogEntry | null> {
  const day = utcMidnight(date);
  const entries = await prisma.metricEntry.findMany({
    where: { metricId: { in: ALL_METRIC_IDS }, date: day },
    select: { metricId: true, numberValue: true, textValue: true },
  });
  return assembleEntry(day, new Map(entries.map((e) => [e.metricId, e])));
}

/** Every DailyLog-equivalent entry, oldest first — feeds the Spondylitis/
 * Sleep/Care area pages' raw-value history display. Unbounded, matching
 * lib/pain-mobility/data.ts's getPainMobilityLogs' own simplicity. */
export async function getDailyLogs(): Promise<DailyLogEntry[]> {
  const entries = await prisma.metricEntry.findMany({
    where: { metricId: { in: ALL_METRIC_IDS } },
    orderBy: { date: "asc" },
    select: { metricId: true, date: true, numberValue: true, textValue: true },
  });

  const byDate = new Map<number, Map<string, RawEntry>>();
  for (const e of entries) {
    const key = e.date.getTime();
    const byMetric = byDate.get(key) ?? new Map<string, RawEntry>();
    byMetric.set(e.metricId, e);
    byDate.set(key, byMetric);
  }

  const results: DailyLogEntry[] = [];
  for (const [ts, byMetric] of [...byDate.entries()].sort((a, b) => a[0] - b[0])) {
    const entry = assembleEntry(new Date(ts), byMetric);
    if (entry) results.push(entry);
  }
  return results;
}

/**
 * mobility/trained, computed fresh from CheckIn rows on the two seeded
 * habits (see lib/daily-log/habit-seed.ts) — unrelated to DailyLog/Metric,
 * untouched by #182. See docs/adr/0007-v2-phase3-daily-log-sheet.md for
 * why. Only ever `true` or `null` (never `false`): a paused habit, a
 * missing habit, or a day with no check-in are all "no signal," not
 * "confirmed didn't happen" — this app never fabricates a negative
 * measurement from an absence of data.
 */
export async function getDerivedStateFields(date: Date): Promise<{ mobility: boolean | null; trained: boolean | null }> {
  const day = utcMidnight(date);

  const activeHabits = await prisma.habit.findMany({
    where: { id: { in: [STRETCH_HABIT_ID, TRAINED_HABIT_ID] }, status: "ACTIVE" },
    select: { id: true },
  });
  const activeIds = new Set(activeHabits.map((h) => h.id));
  if (activeIds.size === 0) return { mobility: null, trained: null };

  const checkIns = await prisma.checkIn.findMany({
    where: { habitId: { in: [...activeIds] }, date: day },
    select: { habitId: true },
  });
  const checkedIn = new Set(checkIns.map((c) => c.habitId));

  return {
    mobility: activeIds.has(STRETCH_HABIT_ID) && checkedIn.has(STRETCH_HABIT_ID) ? true : null,
    trained: activeIds.has(TRAINED_HABIT_ID) && checkedIn.has(TRAINED_HABIT_ID) ? true : null,
  };
}

import "server-only";
import { prisma } from "@/lib/prisma";
import { utcMidnight } from "@/lib/habits/date-utils";
import { STRETCH_HABIT_ID, TRAINED_HABIT_ID } from "./habit-seed";
import { stiffnessBucketFromMidpoint, type HeadacheLevel, type StiffnessBucket } from "./logic";

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

function mapDailyLog(row: {
  id: string;
  date: Date;
  mood: number;
  stress: number;
  energy: number;
  sleepQuality: number;
  pain: number;
  headache: HeadacheLevel;
  stiffness: number;
  weight: number | null;
  waist: number | null;
  bpSystolic: number | null;
  bpDiastolic: number | null;
}): DailyLogEntry {
  return { ...row, stiffnessBucket: stiffnessBucketFromMidpoint(row.stiffness) };
}

export async function getDailyLog(date: Date): Promise<DailyLogEntry | null> {
  const row = await prisma.dailyLog.findUnique({ where: { date: utcMidnight(date) } });
  return row ? mapDailyLog(row) : null;
}

/** Every DailyLog entry, oldest first — feeds the Spondylitis/Sleep/Care
 * area pages' raw-value history display. Unbounded, matching
 * lib/pain-mobility/data.ts's getPainMobilityLogs' own simplicity (no range
 * parameter) — narrowing to a window is a display-layer concern for
 * whichever component renders this, not this query's job. */
export async function getDailyLogs(): Promise<DailyLogEntry[]> {
  const rows = await prisma.dailyLog.findMany({ orderBy: { date: "asc" } });
  return rows.map(mapDailyLog);
}

/**
 * mobility/trained, computed fresh from CheckIn rows on the two seeded
 * habits (see lib/daily-log/habit-seed.ts) rather than stored on DailyLog —
 * see docs/adr/0007-v2-phase3-daily-log-sheet.md and the ensure-seeded
 * ticket's follow-up comment for why. Only ever `true` or `null` (never
 * `false`): a paused habit, a missing habit, or a day with no check-in are
 * all "no signal", not "confirmed didn't happen" — this app never fabricates
 * a negative measurement from an absence of data.
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

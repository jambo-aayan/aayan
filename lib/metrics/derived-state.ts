import "server-only";
import { prisma } from "@/lib/prisma";
import { utcMidnight } from "@/lib/habits/date-utils";
import { STRETCH_HABIT_ID, TRAINED_HABIT_ID } from "@/lib/habits/derived-field-seed";

/**
 * mobility/trained, computed fresh from CheckIn rows on the two seeded
 * habits (see lib/habits/derived-field-seed.ts) — unrelated to the old
 * fixed-shape daily logging sheet or the Metric system that replaced it,
 * unaffected by that sheet's retirement (#182/#188). See
 * docs/adr/0007-v2-phase3-daily-log-sheet.md for why. Only ever `true` or
 * `null` (never `false`): a paused habit, a missing habit, or a day with
 * no check-in are all "no signal," not "confirmed didn't happen" — this
 * app never fabricates a negative measurement from an absence of data.
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

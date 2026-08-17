import { habitsNotCheckedIn, type TodayHabit } from "./today";

/** Share of today's active habits already checked in, 0-100. Null with no active habits — there's nothing to show a percentage of. */
export function dailyFocusPercent(habits: TodayHabit[]): number | null {
  if (habits.length === 0) return null;
  const done = habits.length - habitsNotCheckedIn(habits).length;
  return Math.round((done / habits.length) * 100);
}

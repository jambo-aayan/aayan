import type { HabitScheduleType } from "./schedule";

export type Frequency = "DAILY" | "WEEKLY";

const DAY_MS = 24 * 60 * 60 * 1000;
const ESTABLISHED_DAYS = 7;
const ESTABLISHED_WEEKS = 4;

/**
 * The Monday (UTC midnight) of the ISO week containing `date`. Deliberately
 * not a naive floor(epochDays / 7) bucket — that doesn't align to real
 * Mon-Sun weeks (epoch day 0 was a Thursday), which previously let a
 * Saturday and the immediately following Sunday land in different "weeks".
 */
export function mondayOf(date: Date): Date {
  const utcMidnight = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const day = new Date(utcMidnight).getUTCDay(); // 0=Sun..6=Sat
  const daysSinceMonday = day === 0 ? 6 : day - 1;
  return new Date(utcMidnight - daysSinceMonday * DAY_MS);
}

function uniqueSortedDescending(keys: number[]): number[] {
  return [...new Set(keys)].sort((a, b) => b - a);
}

/** Consecutive calendar days checked in, counting back from the most recent. */
export function dailyStreak(dates: Date[]): number {
  if (dates.length === 0) return 0;

  const dayKeys = dates.map((d) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const sorted = uniqueSortedDescending(dayKeys);

  let streak = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i - 1] - sorted[i] === DAY_MS) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

/** Consecutive Mon-Sun weeks with >=1 check-in, counting back from the most recent. */
export function weeklyStreak(dates: Date[]): number {
  if (dates.length === 0) return 0;

  const weekKeys = dates.map((d) => mondayOf(d).getTime());
  const sorted = uniqueSortedDescending(weekKeys);

  const WEEK_MS = 7 * DAY_MS;
  let streak = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i - 1] - sorted[i] === WEEK_MS) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

export function isEstablished(streak: number, frequency: Frequency): boolean {
  return frequency === "DAILY" ? streak >= ESTABLISHED_DAYS : streak >= ESTABLISHED_WEEKS;
}

/**
 * The count-based analogue of weeklyStreak: consecutive Mon-Sun weeks whose
 * check-in count meets `targetCount`, counting back from the most recent
 * qualifying week. A week that hasn't hit target yet (including the current,
 * still-in-progress one) simply never enters the qualifying-weeks list —
 * the same way weeklyStreak already treats a week with zero check-ins as
 * absent rather than as an explicit break — so it doesn't zero the streak.
 */
export function perWeekStreak(checkInDates: Date[], targetCount: number): number {
  if (checkInDates.length === 0) return 0;

  const countByWeek = new Map<number, number>();
  for (const date of checkInDates) {
    const weekStart = mondayOf(date).getTime();
    countByWeek.set(weekStart, (countByWeek.get(weekStart) ?? 0) + 1);
  }

  const qualifyingWeeks = uniqueSortedDescending(
    [...countByWeek.entries()].filter(([, count]) => count >= targetCount).map(([weekStart]) => weekStart)
  );
  if (qualifyingWeeks.length === 0) return 0;

  const WEEK_MS = 7 * DAY_MS;
  let streak = 1;
  for (let i = 1; i < qualifyingWeeks.length; i++) {
    if (qualifyingWeeks[i - 1] - qualifyingWeeks[i] === WEEK_MS) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

export type StreakHabit = {
  scheduleType: HabitScheduleType;
  scheduleTargetCount: number | null;
  checkInDates: Date[];
};

/**
 * The single place that decides which streak function a habit's schedule
 * type maps to — replaces the `streakFor` helper duplicated across
 * habits-list.tsx and habit-manager.tsx, both of which fell through to
 * dailyStreak for every schedule type except WEEKLY (silently wrong for
 * PER_WEEK, and for any other non-daily, non-weekly type).
 */
export function streakForHabit(habit: StreakHabit): number {
  if (habit.scheduleType === "WEEKLY") return weeklyStreak(habit.checkInDates);
  if (habit.scheduleType === "PER_WEEK") return perWeekStreak(habit.checkInDates, habit.scheduleTargetCount ?? 0);
  return dailyStreak(habit.checkInDates);
}

/** "day streak" for daily-cadence types, "week streak" for the two
 * week-based types — a PER_WEEK streak of 3 weeks read as "3 day streak"
 * would be actively misleading, not just imprecise. Single source for both
 * habit-card components, same reasoning as streakForHabit above. */
export function streakUnitLabel(scheduleType: HabitScheduleType): string {
  return scheduleType === "WEEKLY" || scheduleType === "PER_WEEK" ? "week" : "day";
}

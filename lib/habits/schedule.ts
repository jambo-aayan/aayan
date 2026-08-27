import { mondayOf } from "./streak";
import { utcMidnight } from "./date-utils";

export type HabitScheduleType =
  | "DAILY"
  | "WEEKDAYS"
  | "SELECTED_WEEKDAYS"
  | "WEEKLY"
  | "EVERY_N_DAYS"
  | "EVERY_N_WEEKS"
  | "MONTHLY"
  | "CUSTOM"
  | "PER_WEEK";

export type HabitSchedule = {
  scheduleType: HabitScheduleType;
  scheduleWeekdays: number[];
  scheduleIntervalN: number | null;
  scheduleAnchorDate: Date | null;
  /// Only meaningful for PER_WEEK — "N times a week", a count, not an
  /// interval (scheduleIntervalN means "every N days/weeks"). Optional,
  /// unlike its siblings above: nothing can construct a PER_WEEK habit yet
  /// (Phase 2's UI), so every existing HabitSchedule call site legitimately
  /// has nothing to pass here — making it required would force an
  /// always-null field onto call sites this ticket has no reason to touch.
  scheduleTargetCount?: number | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function matchesMonthlyDay(date: Date, anchor: Date): boolean {
  const targetDay = anchor.getUTCDate();
  const lastDayOfMonth = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  return date.getUTCDate() === Math.min(targetDay, lastDayOfMonth);
}

/**
 * Whether a Habit occurs on `date` — the whole "occurrence" concept for a
 * Habit (see Habit's schema comment): no stored occurrence row, just this
 * computed check against the schedule, paired with a CheckIn if/when it's
 * completed. `doneThisWeek` is a caller-supplied fact (from CheckIn dates)
 * rather than computed here, keeping this function pure — WEEKLY and
 * EVERY_N_WEEKS occur on *any* day of a qualifying week until the week's
 * already been checked in once, at which point they stop occurring for the
 * rest of that week.
 */
export function habitOccursOn(schedule: HabitSchedule, date: Date, doneThisWeek: boolean): boolean {
  switch (schedule.scheduleType) {
    case "DAILY":
      return true;
    case "WEEKDAYS": {
      const day = date.getUTCDay();
      return day >= 1 && day <= 5;
    }
    case "SELECTED_WEEKDAYS":
      return schedule.scheduleWeekdays.includes(date.getUTCDay());
    case "WEEKLY":
      return !doneThisWeek;
    case "EVERY_N_DAYS": {
      if (!schedule.scheduleAnchorDate || !schedule.scheduleIntervalN || schedule.scheduleIntervalN < 1) return false;
      const days = Math.round(
        (utcMidnight(date).getTime() - utcMidnight(schedule.scheduleAnchorDate).getTime()) / DAY_MS
      );
      return days >= 0 && days % schedule.scheduleIntervalN === 0;
    }
    case "EVERY_N_WEEKS": {
      if (!schedule.scheduleAnchorDate || !schedule.scheduleIntervalN || schedule.scheduleIntervalN < 1) return false;
      const weeks = Math.round(
        (mondayOf(date).getTime() - mondayOf(schedule.scheduleAnchorDate).getTime()) / (7 * DAY_MS)
      );
      if (weeks < 0 || weeks % schedule.scheduleIntervalN !== 0) return false;
      return !doneThisWeek;
    }
    case "MONTHLY":
      return schedule.scheduleAnchorDate ? matchesMonthlyDay(date, schedule.scheduleAnchorDate) : false;
    case "CUSTOM":
      // No automatic occurrence — same documented limitation as Task's
      // CUSTOM repeat rule (see lib/tasks/recurrence.ts).
      return false;
    case "PER_WEEK":
      // Count-based ("4x a week"): every day is eligible, since the target
      // is a count, not a set of fixed days. The actual count-vs-target
      // math (expectedCount/doneCount) lands in #84.
      return true;
  }
}

const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function formatScheduleLabel(schedule: HabitSchedule): string {
  switch (schedule.scheduleType) {
    case "DAILY":
      return "Daily";
    case "WEEKDAYS":
      return "Weekdays";
    case "SELECTED_WEEKDAYS":
      return schedule.scheduleWeekdays.length > 0
        ? schedule.scheduleWeekdays
            .slice()
            .sort((a, b) => a - b)
            .map((d) => WEEKDAY_NAMES[d])
            .join(", ")
        : "Selected days";
    case "WEEKLY":
      return "Weekly";
    case "EVERY_N_DAYS":
      return schedule.scheduleIntervalN ? `Every ${schedule.scheduleIntervalN} days` : "Every N days";
    case "EVERY_N_WEEKS":
      return schedule.scheduleIntervalN ? `Every ${schedule.scheduleIntervalN} weeks` : "Every N weeks";
    case "MONTHLY":
      return "Monthly";
    case "CUSTOM":
      return "Custom";
    case "PER_WEEK":
      return schedule.scheduleTargetCount ? `${schedule.scheduleTargetCount}× a week` : "× a week";
  }
}

/**
 * Was this WEEKLY/EVERY_N_WEEKS habit already satisfied earlier in `date`'s
 * Mon-Sun week — strictly *before* `date` itself, not including it. A
 * habit's own completion on a given day doesn't retroactively make that
 * same day "not due" (see the WEEKLY habitOccursOn test: it "occurs until
 * done once this week, then stops" — stops on subsequent days, not
 * simultaneously with the completion that satisfies it).
 */
export function doneEarlierThisWeek(date: Date, loggedDays: Date[]): boolean {
  const weekStart = mondayOf(date).getTime();
  const dayTime = utcMidnight(date).getTime();
  return loggedDays.some((logged) => mondayOf(logged).getTime() === weekStart && utcMidnight(logged).getTime() < dayTime);
}

/**
 * Expected occurrences over `days` — the schedule engine's half of
 * "adherence is always doneCount / expectedCount, never logged ÷ calendar
 * days" (see docs/adr/0005-v2-phase1-foundations-migration.md). PER_WEEK is
 * proportional to the window (`round(days.length / 7 * target)`); every
 * other type is a straight count of days habitOccursOn says are due, with
 * `loggedDays` supplying the WEEKLY/EVERY_N_WEEKS "already satisfied this
 * week" fact those types need (habitOccursOn itself stays pure and
 * per-day — see its own doc comment).
 */
export function expectedCount(schedule: HabitSchedule, days: Date[], loggedDays: Date[]): number {
  if (schedule.scheduleType === "PER_WEEK") {
    return Math.round((days.length / 7) * (schedule.scheduleTargetCount ?? 0));
  }
  return days.filter((day) => habitOccursOn(schedule, day, doneEarlierThisWeek(day, loggedDays))).length;
}

/**
 * Logged occurrences over `days`, restricted to due days — except PER_WEEK,
 * where every day is eligible (no isDue gate), so `doneCount > expectedCount`
 * is legal: a count-based habit can be over-performed, and that must stay
 * visible rather than clamped here (display-layer clamping to 100% for a
 * percentage is a caller concern, not this function's).
 */
export function doneCount(schedule: HabitSchedule, days: Date[], loggedDays: Date[]): number {
  const loggedKeys = new Set(loggedDays.map((d) => utcMidnight(d).getTime()));
  const isLogged = (day: Date) => loggedKeys.has(utcMidnight(day).getTime());

  if (schedule.scheduleType === "PER_WEEK") {
    return days.filter(isLogged).length;
  }
  return days.filter((day) => isLogged(day) && habitOccursOn(schedule, day, doneEarlierThisWeek(day, loggedDays))).length;
}

export type WeeklyShortfall = { daysRemaining: number; shortfall: number };

/** For a PER_WEEK habit only: how many days remain in `today`'s Mon-Sun
 * week (inclusive of today), and how many more occurrences are still
 * needed to hit that week's target. Used by Nudges' "due today"/"at
 * risk" checks below, which need a genuinely different framing for a
 * count-based habit than a daily-consecutive streak (#126, ADR-0011). */
export function weeklyShortfall(schedule: HabitSchedule, today: Date, loggedDays: Date[]): WeeklyShortfall {
  const weekStart = mondayOf(today);
  const todayMid = utcMidnight(today);
  const daysThisWeekSoFar: Date[] = [];
  for (let t = weekStart.getTime(); t <= todayMid.getTime(); t += DAY_MS) daysThisWeekSoFar.push(new Date(t));

  const doneThisWeek = doneCount(schedule, daysThisWeekSoFar, loggedDays);
  const target = schedule.scheduleTargetCount ?? 0;
  const shortfall = Math.max(0, target - doneThisWeek);

  const weekEndMs = weekStart.getTime() + 6 * DAY_MS;
  const daysRemaining = Math.round((weekEndMs - todayMid.getTime()) / DAY_MS) + 1;

  return { daysRemaining, shortfall };
}

/** Whether a habit is due today — for PER_WEEK, "the weekly target hasn't
 * been met yet" (habitOccursOn alone always answers true for PER_WEEK,
 * since the real gate is the count, not a per-day due/not-due split);
 * every other type delegates to habitOccursOn as before (#126,
 * ADR-0011). */
export function isDueToday(schedule: HabitSchedule, today: Date, loggedDays: Date[]): boolean {
  if (schedule.scheduleType === "PER_WEEK") {
    return weeklyShortfall(schedule, today, loggedDays).shortfall > 0;
  }
  return habitOccursOn(schedule, today, doneEarlierThisWeek(today, loggedDays));
}

/** Days past this threshold, a daily-consecutive streak is "worth
 * protecting" for Nudges' STREAK_AT_RISK severity. */
export const STREAK_AT_RISK_DAYS_THRESHOLD = 7;

/** Whether skipping today would put a meaningful streak at risk. For most
 * schedule types this is just "the daily streak is long enough to be
 * worth protecting" (a caller-supplied fact, since daily-streak counting
 * lives in lib/habits/streak.ts, a different concern from this schedule
 * engine). For PER_WEEK, a daily-consecutive count doesn't apply at all
 * — "at risk" instead means every remaining day this week is needed to
 * still hit the target, i.e. zero slack left (#126, ADR-0011). */
export function isStreakAtRisk(
  schedule: HabitSchedule,
  today: Date,
  loggedDays: Date[],
  dailyStreakDays: number
): boolean {
  if (schedule.scheduleType === "PER_WEEK") {
    const { daysRemaining, shortfall } = weeklyShortfall(schedule, today, loggedDays);
    return shortfall > 0 && daysRemaining <= shortfall;
  }
  return dailyStreakDays > STREAK_AT_RISK_DAYS_THRESHOLD;
}

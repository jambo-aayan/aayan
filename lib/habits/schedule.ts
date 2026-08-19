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
  | "CUSTOM";

export type HabitSchedule = {
  scheduleType: HabitScheduleType;
  scheduleWeekdays: number[];
  scheduleIntervalN: number | null;
  scheduleAnchorDate: Date | null;
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
  }
}

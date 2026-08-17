import type { TaskRepeatRule } from "./types";

function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function addUtcMonths(date: Date, months: number): Date {
  const next = new Date(date);
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
}

/**
 * The next occurrence's due date after completing one, for a repeating task.
 * Returns null for CUSTOM — an arbitrary custom rule (stored only as free
 * text, see Task.repeatRule's schema comment) has nothing here to compute
 * from automatically; the task simply stops recurring until manually
 * rescheduled. This is the documented limitation on recurrence, not a bug.
 */
export function nextOccurrenceDate(rule: TaskRepeatRule, fromDueDate: Date): Date | null {
  switch (rule) {
    case "DAILY":
      return addUtcDays(fromDueDate, 1);
    case "WEEKLY":
      return addUtcDays(fromDueDate, 7);
    case "MONTHLY":
      return addUtcMonths(fromDueDate, 1);
    case "WEEKDAYS": {
      let next = addUtcDays(fromDueDate, 1);
      while (next.getUTCDay() === 0 || next.getUTCDay() === 6) {
        next = addUtcDays(next, 1);
      }
      return next;
    }
    case "CUSTOM":
      return null;
  }
}

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

export type RecurrenceOptions = {
  /** Required for SELECTED_WEEKDAYS — 0 (Sun) to 6 (Sat). */
  weekdays?: number[];
  /** Required for EVERY_N_DAYS — must be >= 1. */
  intervalN?: number | null;
};

/**
 * The next occurrence's due date after completing one, for a repeating task.
 * Returns null for CUSTOM — an arbitrary custom rule (stored only as free
 * text, see Task.repeatRule's schema comment) has nothing here to compute
 * from automatically; the task simply stops recurring until manually
 * rescheduled. This is the documented limitation on recurrence, not a bug.
 * Also returns null for SELECTED_WEEKDAYS with no days chosen, or
 * EVERY_N_DAYS with no positive interval — both are incomplete
 * configurations, not a rule the picker should be able to produce.
 */
export function nextOccurrenceDate(rule: TaskRepeatRule, fromDueDate: Date, options: RecurrenceOptions = {}): Date | null {
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
    case "SELECTED_WEEKDAYS": {
      const weekdays = options.weekdays ?? [];
      if (weekdays.length === 0) return null;
      let next = addUtcDays(fromDueDate, 1);
      for (let i = 0; i < 7; i++) {
        if (weekdays.includes(next.getUTCDay())) return next;
        next = addUtcDays(next, 1);
      }
      return null;
    }
    case "EVERY_N_DAYS": {
      const intervalN = options.intervalN;
      if (!intervalN || intervalN < 1) return null;
      return addUtcDays(fromDueDate, intervalN);
    }
    case "CUSTOM":
      return null;
  }
}

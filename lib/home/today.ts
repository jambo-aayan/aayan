import { isSameUtcDay } from "../habits/date-utils";
import type { GoalStatus } from "../action-goals/status";

export type TodayHabit = { id: string; todayLevel: "FULL" | "MINIMUM" | null };

export type TodayGoalCandidate = {
  id: string;
  status: GoalStatus;
  dueDate: Date | null;
  myday: boolean;
};

/** Active habits with no check-in yet today — the actionable subset for the Today view. */
export function habitsNotCheckedIn<T extends TodayHabit>(habits: T[]): T[] {
  return habits.filter((h) => h.todayLevel === null);
}

/**
 * The Today view's Goals: myday-flagged goals (regardless of due date) plus
 * any goal due exactly today (regardless of myday), deduped — a goal that's
 * both only appears once.
 */
export function todaysGoals<T extends TodayGoalCandidate>(goals: T[], today: Date): T[] {
  return goals.filter((g) => g.myday || (g.dueDate !== null && isSameUtcDay(g.dueDate, today)));
}

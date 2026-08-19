export type TodayHabit = { id: string; todayLevel: "FULL" | "MINIMUM" | null };

/** Habit occurrences with no check-in yet today — the actionable subset for the Today view. */
export function habitsNotCheckedIn<T extends TodayHabit>(habits: T[]): T[] {
  return habits.filter((h) => h.todayLevel === null);
}

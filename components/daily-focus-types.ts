/** The slice of a Habit the sidebar's Daily-focus widget and the mobile
 * drawer's nav both need — not the full HabitWithRelations shape. */
export type DailyFocusHabit = {
  id: string;
  name: string;
  todayLevel: "FULL" | "MINIMUM" | null;
  pillarColor: string | null;
};

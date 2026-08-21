/** The slice of a Habit the sidebar's Daily-focus widget and the mobile
 * drawer's nav both need — not the full HabitWithRelations shape. */
export type DailyFocusHabit = {
  id: string;
  name: string;
  todayLevel: "FULL" | "MINIMUM" | null;
  /** Already resolved to hex (see lib/colors.ts's resolveColorHex) — not a
   * stored color key. */
  pillarColor: string | null;
};

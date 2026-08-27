export type HabitStatus = "ACTIVE" | "PAUSED" | "ARCHIVED";

/** ARCHIVED reads "Retired" in the UI (matching the handoff's copy — see
 * docs/adr/0006-v2-phase2-habits-tasks.md) while the schema/enum value
 * stays ARCHIVED. The single source of truth for this mapping, replacing
 * the copy duplicated across habits-filters.tsx, habit-manager.tsx's
 * STATUS_LABEL, and habits-list.tsx's inline ternary. */
export const HABIT_STATUS_LABEL: Record<HabitStatus, string> = {
  ACTIVE: "Active",
  PAUSED: "Paused",
  ARCHIVED: "Retired",
};

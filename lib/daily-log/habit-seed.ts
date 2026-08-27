/** Stable ids for the two Habits that back DailyLog's derived fields (see
 * docs/adr/0007-v2-phase3-daily-log-sheet.md) — a name lookup would silently
 * break if the user renamed either habit, so the derivation always keys off
 * these fixed ids instead, same as lib/health/seed-data.ts's
 * ANKYLOSING_SPONDYLITIS_AREA_ID. */
export const STRETCH_HABIT_ID = "stretch-routine";
export const STRETCH_HABIT_NAME = "Stretch routine";

export const TRAINED_HABIT_ID = "trained-today";
export const TRAINED_HABIT_NAME = "Trained today";

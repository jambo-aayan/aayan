import "server-only";
import { prisma } from "@/lib/prisma";
import { HEALTH_PILLAR_ID, ANKYLOSING_SPONDYLITIS_AREA_ID, TRAINING_AND_BODY_AREA_ID } from "@/lib/health/seed-data";

/** Stable ids for the two Habits mobility/trained (lib/metrics/derived-state.ts's
 * getDerivedStateFields) derive from — a name lookup would silently break if
 * the user renamed either habit, so the derivation always keys off these
 * fixed ids instead, same as lib/health/seed-data.ts's
 * ANKYLOSING_SPONDYLITIS_AREA_ID. Moved here (#188) once the old fixed-shape
 * daily logging sheet these two Habits used to live alongside was fully
 * retired in favor of the generic Metric system — the Habits themselves
 * were always independent of that sheet's own data. */
export const STRETCH_HABIT_ID = "stretch-routine";
export const STRETCH_HABIT_NAME = "Stretch routine";

export const TRAINED_HABIT_ID = "trained-today";
export const TRAINED_HABIT_NAME = "Trained today";

/**
 * Seeds the two Habits mobility/trained derive from. Idempotent,
 * upsert-and-never-touch-existing — same pattern as
 * lib/health/ensure-seeded.ts's ensureHealthAreasSeeded, so a reseed never
 * duplicates them or clobbers a user's own edits (a renamed habit, a
 * different schedule). Paused by default, matching every other habit's
 * default status (CONTEXT.md's opt-in principle) — seeding them doesn't
 * mean the user has to run them, just that a stable id exists to check
 * in on if they choose to.
 */
export async function ensureDerivedFieldHabitsSeeded(): Promise<void> {
  await prisma.habit.upsert({
    where: { id: STRETCH_HABIT_ID },
    create: {
      id: STRETCH_HABIT_ID,
      name: STRETCH_HABIT_NAME,
      pillarId: HEALTH_PILLAR_ID,
      areaId: ANKYLOSING_SPONDYLITIS_AREA_ID,
      status: "PAUSED",
      scheduleType: "DAILY",
    },
    update: {},
  });

  await prisma.habit.upsert({
    where: { id: TRAINED_HABIT_ID },
    create: {
      id: TRAINED_HABIT_ID,
      name: TRAINED_HABIT_NAME,
      pillarId: HEALTH_PILLAR_ID,
      areaId: TRAINING_AND_BODY_AREA_ID,
      status: "PAUSED",
      scheduleType: "DAILY",
    },
    update: {},
  });
}

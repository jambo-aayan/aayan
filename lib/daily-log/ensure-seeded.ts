import "server-only";
import { prisma } from "@/lib/prisma";
import { HEALTH_PILLAR_ID, ANKYLOSING_SPONDYLITIS_AREA_ID, TRAINING_AND_BODY_AREA_ID } from "@/lib/health/seed-data";
import { STRETCH_HABIT_ID, STRETCH_HABIT_NAME, TRAINED_HABIT_ID, TRAINED_HABIT_NAME } from "./habit-seed";

/**
 * Seeds the two Habits DailyLog's mobility/trained fields derive from.
 * Idempotent, upsert-and-never-touch-existing — same pattern as
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

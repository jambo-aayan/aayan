-- v2 Phase 1 (Foundations) — see docs/adr/0005-v2-phase1-foundations-migration.md
--
-- Three independent changes: a new count-based habit schedule shape, and a
-- one-time reshape of the Health Pillar's Areas. The Miscellaneous Pillar is
-- deliberately NOT created here — Pillars are seeded lazily by application
-- code (lib/pillars/data.ts's ensure*Seeded calls), matching how Health's
-- and Finance's Pillar rows already come into being; a migration-level
-- INSERT would fight that idempotent-seed pattern instead of using it.

-- CreateEnum value: count-based ("N times a week") habit schedules.
ALTER TYPE "HabitScheduleType" ADD VALUE 'PER_WEEK';

-- AlterTable: scheduleTargetCount is nullable and only meaningful for
-- PER_WEEK habits — no existing Habit row is affected.
ALTER TABLE "Habit" ADD COLUMN     "scheduleTargetCount" INTEGER;

-- Health Area restructure (ADR-0005). Every statement below is a safe no-op
-- on a database where these Area rows don't exist yet (a fresh install,
-- where lib/health/seed-data.ts's updated HEALTH_AREAS_SEED seeds the v2
-- structure directly on first load) — this section exists to reshape rows
-- that already exist in a live database with real user data.

-- Rename-in-place: same id, new name. No FK rows reference an Area by name,
-- so nothing downstream needs to change. "looks" also gets its sortOrder
-- corrected from 5 to 4 — its old position collides with Care's below
-- otherwise, and 4 is where Grooming sits in the updated
-- lib/health/seed-data.ts (a fresh install seeds this order directly).
UPDATE "Area" SET "name" = 'Spondylitis' WHERE id = 'ankylosing-spondylitis';
UPDATE "Area" SET "name" = 'Training & body' WHERE id = 'body-composition';
UPDATE "Area" SET "name" = 'Grooming', "sortOrder" = 4 WHERE id = 'looks';

-- Merge: Blood Pressure + Healthcare Navigation -> Care. A genuine reshape,
-- not a rename — every row across the five FK-referencing tables currently
-- pointing at either old Area gets re-pointed to the new "care" Area before
-- the old rows are removed, so nothing is left orphaned. pillarId is
-- hardcoded to 'health' (see lib/health/seed-data.ts's HEALTH_PILLAR_ID)
-- rather than read off either source row, and the existence check covers
-- both possible survivors, so this still fires correctly even if only one
-- of the two legacy Areas is present.
INSERT INTO "Area" (id, "pillarId", "name", "sortOrder", "createdAt", "updatedAt")
SELECT 'care', 'health', 'Care', 5, now(), now()
WHERE EXISTS (SELECT 1 FROM "Area" WHERE id IN ('blood-pressure', 'healthcare-navigation'))
ON CONFLICT (id) DO NOTHING;

UPDATE "Habit" SET "areaId" = 'care' WHERE "areaId" IN ('blood-pressure', 'healthcare-navigation');
UPDATE "Task" SET "areaId" = 'care' WHERE "areaId" IN ('blood-pressure', 'healthcare-navigation');
UPDATE "LifeGoal" SET "areaId" = 'care' WHERE "areaId" IN ('blood-pressure', 'healthcare-navigation');
UPDATE "PainMobilityLog" SET "areaId" = 'care' WHERE "areaId" IN ('blood-pressure', 'healthcare-navigation');
UPDATE "Thought" SET "areaId" = 'care' WHERE "areaId" IN ('blood-pressure', 'healthcare-navigation');

DELETE FROM "Area" WHERE id IN ('blood-pressure', 'healthcare-navigation');

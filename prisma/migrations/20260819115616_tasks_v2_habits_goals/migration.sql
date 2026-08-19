-- CreateEnum
CREATE TYPE "HabitStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "HabitScheduleType" AS ENUM ('DAILY', 'WEEKDAYS', 'SELECTED_WEEKDAYS', 'WEEKLY', 'EVERY_N_DAYS', 'EVERY_N_WEEKS', 'MONTHLY', 'CUSTOM');

-- CreateEnum
CREATE TYPE "LifeGoalStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED');

-- AlterTable: add new Habit columns first, all nullable/defaulted so existing
-- rows stay valid while we backfill from them below.
ALTER TABLE "Habit" DROP CONSTRAINT "Habit_areaId_fkey";

ALTER TABLE "Habit"
  ADD COLUMN     "pillarId" TEXT,
  ADD COLUMN     "scheduleAnchorDate" DATE,
  ADD COLUMN     "scheduleCustomText" TEXT,
  ADD COLUMN     "scheduleIntervalN" INTEGER,
  ADD COLUMN     "scheduleType" "HabitScheduleType" NOT NULL DEFAULT 'DAILY',
  ADD COLUMN     "scheduleWeekdays" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
  ADD COLUMN     "status" "HabitStatus" NOT NULL DEFAULT 'PAUSED',
  ALTER COLUMN "areaId" DROP NOT NULL,
  ALTER COLUMN "frequency" SET DEFAULT 'DAILY';

-- Backfill pillarId from each habit's existing area, and status from the
-- boolean it replaces (active:true -> ACTIVE, active:false -> PAUSED, same
-- meaning as before) — both before the column that fed them is dropped/
-- constrained, so no existing habit (including real production data) loses
-- its active/inactive state or ends up with a null required pillarId.
UPDATE "Habit" h
SET "pillarId" = a."pillarId"
FROM "Area" a
WHERE a.id = h."areaId";

UPDATE "Habit"
SET "status" = CASE WHEN "active" THEN 'ACTIVE'::"HabitStatus" ELSE 'PAUSED'::"HabitStatus" END;

ALTER TABLE "Habit" ALTER COLUMN "pillarId" SET NOT NULL;
ALTER TABLE "Habit" DROP COLUMN "active";

-- AlterTable
ALTER TABLE "MyDayEntry" ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Pillar" ADD COLUMN     "color" TEXT;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "areaId" TEXT,
ADD COLUMN     "goalId" TEXT,
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "TaskList" ADD COLUMN     "color" TEXT;

-- CreateTable
CREATE TABLE "HabitGoal" (
    "habitId" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "HabitGoal_pkey" PRIMARY KEY ("habitId","goalId")
);

-- CreateTable
CREATE TABLE "LifeGoal" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "LifeGoalStatus" NOT NULL DEFAULT 'ACTIVE',
    "pillarId" TEXT NOT NULL,
    "areaId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LifeGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskStep" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskStep_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HabitGoal_goalId_idx" ON "HabitGoal"("goalId");

-- CreateIndex
CREATE INDEX "LifeGoal_pillarId_idx" ON "LifeGoal"("pillarId");

-- CreateIndex
CREATE INDEX "LifeGoal_areaId_idx" ON "LifeGoal"("areaId");

-- CreateIndex
CREATE INDEX "TaskStep_taskId_idx" ON "TaskStep"("taskId");

-- CreateIndex
CREATE INDEX "Habit_pillarId_idx" ON "Habit"("pillarId");

-- CreateIndex
CREATE INDEX "Task_areaId_idx" ON "Task"("areaId");

-- CreateIndex
CREATE INDEX "Task_goalId_idx" ON "Task"("goalId");

-- AddForeignKey
ALTER TABLE "Habit" ADD CONSTRAINT "Habit_pillarId_fkey" FOREIGN KEY ("pillarId") REFERENCES "Pillar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Habit" ADD CONSTRAINT "Habit_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HabitGoal" ADD CONSTRAINT "HabitGoal_habitId_fkey" FOREIGN KEY ("habitId") REFERENCES "Habit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HabitGoal" ADD CONSTRAINT "HabitGoal_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "LifeGoal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LifeGoal" ADD CONSTRAINT "LifeGoal_pillarId_fkey" FOREIGN KEY ("pillarId") REFERENCES "Pillar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LifeGoal" ADD CONSTRAINT "LifeGoal_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "LifeGoal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskStep" ADD CONSTRAINT "TaskStep_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Data migration: ActionGoal (the legacy one-off-action model, scoped only
-- to Health Areas) is superseded by Task, which now covers the same role
-- app-wide via Task.areaId. Every existing ActionGoal row is copied forward
-- into Task, id preserved, so nothing the user already entered is lost —
-- the ActionGoal table itself is left in place afterward (unused by any app
-- code from this point on) rather than dropped, since this is real
-- production data and a table left in place is trivially reversible in a
-- way a DROP TABLE is not.
INSERT INTO "Task" (
  "id", "title", "notes", "status", "important", "sortOrder",
  "listId", "pillarId", "areaId", "goalId",
  "dueDate", "dueTime", "reminderOffset", "repeatRule",
  "completedAt", "archivedAt", "deletedAt",
  "createdAt", "updatedAt"
)
SELECT
  ag."id",
  ag."name",
  NULL,
  CASE WHEN ag."status" = 'DONE' THEN 'COMPLETED'::"TaskStatus" ELSE 'ACTIVE'::"TaskStatus" END,
  false,
  0,
  NULL,
  a."pillarId",
  ag."areaId",
  NULL,
  ag."dueDate",
  NULL,
  NULL,
  NULL,
  CASE WHEN ag."status" = 'DONE' THEN ag."updatedAt" ELSE NULL END,
  NULL,
  NULL,
  ag."createdAt",
  ag."updatedAt"
FROM "ActionGoal" ag
JOIN "Area" a ON a."id" = ag."areaId";

-- Any ActionGoal that was flagged myday:true gets a MyDayEntry for *today*
-- (the old model never recorded which date it was added, so this is the
-- best-faithful translation — it makes the task show up in My Day again
-- immediately, same as it did under the old boolean, without inventing
-- history that was never actually captured).
INSERT INTO "MyDayEntry" ("id", "taskId", "date", "sortOrder", "addedAt")
SELECT gen_random_uuid()::text, ag."id", CURRENT_DATE, 0, now()
FROM "ActionGoal" ag
WHERE ag."myday" = true;

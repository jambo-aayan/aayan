-- CreateEnum
CREATE TYPE "NudgeType" AS ENUM ('HABIT_DUE', 'TASK_OVERDUE', 'STREAK_AT_RISK', 'WEEKLY_REVIEW_READY', 'METRIC_OFF_TARGET', 'MORNING_BRIEF');

-- CreateEnum
CREATE TYPE "NudgeTargetType" AS ENUM ('HABIT', 'TASK', 'NONE');

-- CreateTable
CREATE TABLE "Nudge" (
    "id" TEXT NOT NULL,
    "dedupKey" TEXT NOT NULL,
    "type" "NudgeType" NOT NULL,
    "severity" INTEGER NOT NULL,
    "targetType" "NudgeTargetType" NOT NULL DEFAULT 'NONE',
    "targetId" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),
    "snoozedUntil" TIMESTAMP(3),

    CONSTRAINT "Nudge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Nudge_dedupKey_key" ON "Nudge"("dedupKey");

-- CreateIndex
CREATE INDEX "Nudge_readAt_idx" ON "Nudge"("readAt");

-- CreateIndex
CREATE INDEX "Nudge_snoozedUntil_idx" ON "Nudge"("snoozedUntil");

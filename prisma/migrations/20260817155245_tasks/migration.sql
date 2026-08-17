-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('ACTIVE', 'COMPLETED');

-- CreateEnum
CREATE TYPE "TaskReminderOffset" AS ENUM ('AT_DUE', 'MIN_15_BEFORE', 'HOUR_1_BEFORE', 'DAY_1_BEFORE', 'CUSTOM');

-- CreateEnum
CREATE TYPE "TaskRepeatRule" AS ENUM ('DAILY', 'WEEKDAYS', 'WEEKLY', 'MONTHLY', 'CUSTOM');

-- CreateTable
CREATE TABLE "TaskList" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskTag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskTagOnTask" (
    "taskId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "TaskTagOnTask_pkey" PRIMARY KEY ("taskId","tagId")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'ACTIVE',
    "important" BOOLEAN NOT NULL DEFAULT false,
    "listId" TEXT,
    "pillarId" TEXT,
    "dueDate" DATE,
    "dueTime" TEXT,
    "reminderOffset" "TaskReminderOffset",
    "repeatRule" "TaskRepeatRule",
    "completedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MyDayEntry" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MyDayEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TaskTag_name_key" ON "TaskTag"("name");

-- CreateIndex
CREATE INDEX "TaskTagOnTask_tagId_idx" ON "TaskTagOnTask"("tagId");

-- CreateIndex
CREATE INDEX "Task_listId_idx" ON "Task"("listId");

-- CreateIndex
CREATE INDEX "Task_pillarId_idx" ON "Task"("pillarId");

-- CreateIndex
CREATE INDEX "Task_dueDate_idx" ON "Task"("dueDate");

-- CreateIndex
CREATE INDEX "Task_status_idx" ON "Task"("status");

-- CreateIndex
CREATE INDEX "MyDayEntry_date_idx" ON "MyDayEntry"("date");

-- CreateIndex
CREATE UNIQUE INDEX "MyDayEntry_taskId_date_key" ON "MyDayEntry"("taskId", "date");

-- AddForeignKey
ALTER TABLE "TaskTagOnTask" ADD CONSTRAINT "TaskTagOnTask_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskTagOnTask" ADD CONSTRAINT "TaskTagOnTask_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "TaskTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_listId_fkey" FOREIGN KEY ("listId") REFERENCES "TaskList"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_pillarId_fkey" FOREIGN KEY ("pillarId") REFERENCES "Pillar"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MyDayEntry" ADD CONSTRAINT "MyDayEntry_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "SystemType" AS ENUM ('PROCESS', 'EXPERIMENT');

-- CreateEnum
CREATE TYPE "SystemState" AS ENUM ('ACTIVE', 'PAUSED', 'DRAFT', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "SystemStepType" AS ENUM ('CHECKLIST', 'CHECKPOINT', 'MILESTONE', 'MEASURE', 'REPEATING');

-- CreateTable
CREATE TABLE "System" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pillarId" TEXT NOT NULL,
    "areaId" TEXT,
    "type" "SystemType" NOT NULL,
    "state" "SystemState" NOT NULL DEFAULT 'ACTIVE',
    "body" TEXT,
    "reference" TEXT,
    "review" DATE,
    "reviewOffsetDays" INTEGER,
    "criteria" TEXT,
    "sequential" BOOLEAN NOT NULL DEFAULT false,
    "isTemplate" BOOLEAN NOT NULL DEFAULT false,
    "runNoun" TEXT,
    "templateId" TEXT,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "System_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemStep" (
    "id" TEXT NOT NULL,
    "systemId" TEXT NOT NULL,
    "type" "SystemStepType" NOT NULL,
    "text" TEXT NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "doneOn" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemDecision" (
    "id" TEXT NOT NULL,
    "systemId" TEXT NOT NULL,
    "when" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "body" TEXT NOT NULL,

    CONSTRAINT "SystemDecision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SystemDecision_systemId_idx" ON "SystemDecision"("systemId");

-- AddForeignKey
ALTER TABLE "SystemDecision" ADD CONSTRAINT "SystemDecision_systemId_fkey" FOREIGN KEY ("systemId") REFERENCES "System"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "System_pillarId_idx" ON "System"("pillarId");

-- CreateIndex
CREATE INDEX "System_areaId_idx" ON "System"("areaId");

-- CreateIndex
CREATE INDEX "System_templateId_idx" ON "System"("templateId");

-- CreateIndex
CREATE INDEX "System_parentId_idx" ON "System"("parentId");

-- CreateIndex
CREATE INDEX "SystemStep_systemId_idx" ON "SystemStep"("systemId");

-- AddForeignKey
ALTER TABLE "System" ADD CONSTRAINT "System_pillarId_fkey" FOREIGN KEY ("pillarId") REFERENCES "Pillar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "System" ADD CONSTRAINT "System_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "System" ADD CONSTRAINT "System_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "System"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "System" ADD CONSTRAINT "System_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "System"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SystemStep" ADD CONSTRAINT "SystemStep_systemId_fkey" FOREIGN KEY ("systemId") REFERENCES "System"("id") ON DELETE CASCADE ON UPDATE CASCADE;

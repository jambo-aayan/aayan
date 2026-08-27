-- CreateEnum
CREATE TYPE "SystemStepEndCondition" AS ENUM ('FIXED_COUNT', 'REVIEW_DATE');

-- AlterTable
ALTER TABLE "SystemStep" ADD COLUMN "cadenceDays" INTEGER,
ADD COLUMN "endCondition" "SystemStepEndCondition",
ADD COLUMN "endValue" INTEGER;

-- CreateTable
CREATE TABLE "SystemStepOccurrence" (
    "id" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "occurredOn" DATE NOT NULL,
    "loggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemStepOccurrence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SystemStepOccurrence_stepId_idx" ON "SystemStepOccurrence"("stepId");

-- AddForeignKey
ALTER TABLE "SystemStepOccurrence" ADD CONSTRAINT "SystemStepOccurrence_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "SystemStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;

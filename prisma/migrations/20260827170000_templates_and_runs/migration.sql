-- CreateEnum
CREATE TYPE "SystemVerdict" AS ENUM ('CONTINUE', 'ESCALATE', 'STOP');

-- AlterTable
ALTER TABLE "System" ADD COLUMN "runEnd" TIMESTAMP(3),
ADD COLUMN "runStepsDone" INTEGER,
ADD COLUMN "runOutcome" TEXT,
ADD COLUMN "runRating" DOUBLE PRECISION,
ADD COLUMN "verdict" "SystemVerdict";

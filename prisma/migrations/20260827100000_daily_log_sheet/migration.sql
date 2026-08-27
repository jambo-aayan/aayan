-- v2 Phase 3 (Daily log sheet) — see docs/adr/0007-v2-phase3-daily-log-sheet.md
--
-- A brand-new table and a brand-new enum, both fully additive. PainMobilityLog
-- is not touched in any way — it stays Area-scoped, 0-10 scale, exactly as it
-- is; this is a genuinely separate model, not a reshape of it.

CREATE TYPE "HeadacheLevel" AS ENUM ('NONE', 'MILD', 'MODERATE', 'BAD');

CREATE TABLE "DailyLog" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "mood" INTEGER NOT NULL,
    "stress" INTEGER NOT NULL,
    "energy" INTEGER NOT NULL,
    "sleepQuality" INTEGER NOT NULL,
    "pain" INTEGER NOT NULL,
    "headache" "HeadacheLevel" NOT NULL,
    "stiffness" INTEGER NOT NULL,
    "weight" DOUBLE PRECISION,
    "waist" DOUBLE PRECISION,
    "bpSystolic" INTEGER,
    "bpDiastolic" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DailyLog_date_key" ON "DailyLog"("date");

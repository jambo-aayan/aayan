-- #129 (System Evaluation) — see docs/adr/0011-v2-phase6-insights.md.
--
-- A dated "how is this actually going, right now" log entry, independent of
-- a Process's runOutcome/runEnd or an Experiment's verdict. Three required
-- 1-5 ratings, never blended into one stored score — the overall score is
-- always computed at read time (lib/systems/evaluation.ts).

CREATE TABLE "SystemEvaluation" (
  "id" TEXT NOT NULL,
  "systemId" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "effectiveness" INTEGER NOT NULL,
  "consistency" INTEGER NOT NULL,
  "sustainability" INTEGER NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SystemEvaluation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SystemEvaluation_systemId_idx" ON "SystemEvaluation"("systemId");

ALTER TABLE "SystemEvaluation" ADD CONSTRAINT "SystemEvaluation_systemId_fkey" FOREIGN KEY ("systemId") REFERENCES "System"("id") ON DELETE CASCADE ON UPDATE CASCADE;

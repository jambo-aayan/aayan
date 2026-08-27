-- #120 (Goal contribution log) — see docs/adr/0010-v2-phase5-finances.md.
--
-- Goal.saved is no longer a stored column — it becomes the computed sum of a new
-- GoalContribution table, mirroring Account/Snapshot's "value lives in dated child rows"
-- shape. Every existing Goal's current saved value is backfilled as its first
-- GoalContribution (dated today) before the column is dropped, so no data is lost —
-- same pattern as the Item->Account/Snapshot migration. Transaction.goalContributionId
-- mirrors Transaction.receivableId exactly, for the "this went toward Goal X"
-- reclassification (#120), mutually exclusive with receivableId (enforced in
-- lib/finance/logic.ts and lib/finance/actions.ts, not the schema).

CREATE TABLE "GoalContribution" (
  "id" TEXT NOT NULL,
  "goalId" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GoalContribution_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GoalContribution_goalId_idx" ON "GoalContribution"("goalId");

ALTER TABLE "GoalContribution" ADD CONSTRAINT "GoalContribution_goalId_fkey"
  FOREIGN KEY ("goalId") REFERENCES "Goal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: every existing Goal's current saved value becomes its first GoalContribution,
-- dated today. Deterministic id (no gen_random_uuid/pgcrypto dependency) — unique because
-- Goal.id is.
INSERT INTO "GoalContribution" ("id", "goalId", "date", "amount", "note", "createdAt")
SELECT 'seed_' || "id", "id", CURRENT_DATE, "saved", 'Migrated from prior saved total', CURRENT_TIMESTAMP
FROM "Goal";

ALTER TABLE "Goal" DROP COLUMN "saved";

ALTER TABLE "Transaction" ADD COLUMN "goalContributionId" TEXT;

CREATE INDEX "Transaction_goalContributionId_idx" ON "Transaction"("goalContributionId");

ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_goalContributionId_fkey"
  FOREIGN KEY ("goalContributionId") REFERENCES "GoalContribution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

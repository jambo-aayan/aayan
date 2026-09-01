-- #148 (Statement model + upload naming) — see docs/adr/0015-finance-data-integrity-and-transaction-browsing.md.
--
-- One row per statement upload — the record of the upload event itself,
-- distinct from the Snapshot (balance) and Transactions (line items) it
-- produces. sourceFileUrl moves off Snapshot onto here (it's a property
-- of the uploaded document, not of the balance point derived from it —
-- a manual balance edit has no source file at all).

CREATE TABLE "Statement" (
  "id" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "institutionName" TEXT,
  "periodStart" DATE,
  "periodEnd" DATE,
  "sourceFileUrl" TEXT NOT NULL,
  "originalFilename" TEXT,
  "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Statement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Statement_accountId_idx" ON "Statement"("accountId");

ALTER TABLE "Statement" ADD CONSTRAINT "Statement_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: one Statement per existing Snapshot that has a sourceFileUrl
-- (every prior statement/valuation upload) — using the fallback naming
-- format ("{account} — Statement {date}") since no institution/period was
-- ever extracted for these historical rows. "_backfillSnapshotId" is a
-- temporary column purely to join the new Statement back to the Snapshot
-- it came from in the next step; dropped once that's done.
ALTER TABLE "Statement" ADD COLUMN "_backfillSnapshotId" TEXT;

INSERT INTO "Statement" ("id", "accountId", "name", "sourceFileUrl", "uploadedAt", "_backfillSnapshotId")
SELECT
  gen_random_uuid()::text,
  s."accountId",
  a."name" || ' — Statement ' || to_char(s."date", 'DD Mon YYYY'),
  s."sourceFileUrl",
  s."createdAt",
  s."id"
FROM "Snapshot" s
JOIN "Account" a ON a."id" = s."accountId"
WHERE s."sourceFileUrl" IS NOT NULL;

ALTER TABLE "Snapshot" ADD COLUMN "statementId" TEXT;

UPDATE "Snapshot" s
SET "statementId" = st."id"
FROM "Statement" st
WHERE st."_backfillSnapshotId" = s."id";

ALTER TABLE "Statement" DROP COLUMN "_backfillSnapshotId";

CREATE INDEX "Snapshot_statementId_idx" ON "Snapshot"("statementId");

ALTER TABLE "Snapshot" ADD CONSTRAINT "Snapshot_statementId_fkey"
  FOREIGN KEY ("statementId") REFERENCES "Statement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Snapshot" DROP COLUMN "sourceFileUrl";

ALTER TABLE "Transaction" ADD COLUMN "statementId" TEXT;

CREATE INDEX "Transaction_statementId_idx" ON "Transaction"("statementId");

ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_statementId_fkey"
  FOREIGN KEY ("statementId") REFERENCES "Statement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

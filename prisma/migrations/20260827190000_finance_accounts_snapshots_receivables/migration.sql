-- v2 Phase 5 (Finances) foundation — see #112/#113 and docs/adr/0010-v2-phase5-finances.md,
-- following the shape ADR-0005 pre-agreed.
--
-- Item -> Account (rename + reshape): an Account's value now comes from its own dated
-- Snapshot rows, not a single overwritten column. Every existing Item's current value is
-- backfilled as its first Snapshot (dated today) before the column is dropped, so no data
-- is lost. New Receivable table (schema only — its actions/reclassification flow is #114).
-- Transaction.linkedItemId (a documented placeholder nothing ever populated) becomes a
-- real accountId FK.

ALTER TABLE "Item" RENAME TO "Account";
ALTER TABLE "Account" RENAME CONSTRAINT "Item_pkey" TO "Account_pkey";
ALTER TABLE "Account" RENAME COLUMN "liquid" TO "accessible";
ALTER TYPE "ItemType" RENAME TO "AccountType";

CREATE TYPE "AccountKind" AS ENUM ('TRANSACTIONAL', 'VALUATION');

ALTER TABLE "Account"
  ADD COLUMN "kind" "AccountKind" NOT NULL DEFAULT 'VALUATION',
  ADD COLUMN "cls" TEXT,
  ADD COLUMN "manualOnly" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "Snapshot" (
  "id" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "balance" DECIMAL(12,2) NOT NULL,
  "sourceFileUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Snapshot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Snapshot_accountId_date_idx" ON "Snapshot"("accountId", "date");

ALTER TABLE "Snapshot" ADD CONSTRAINT "Snapshot_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: every existing Account's current value becomes its first Snapshot, dated today.
-- Deterministic id (no gen_random_uuid/pgcrypto dependency) — unique because Account.id is.
INSERT INTO "Snapshot" ("id", "accountId", "date", "balance", "createdAt")
SELECT 'seed_' || "id", "id", CURRENT_DATE, "value", CURRENT_TIMESTAMP
FROM "Account";

ALTER TABLE "Account" DROP COLUMN "value";

CREATE TYPE "ReceivableStatus" AS ENUM ('OPEN', 'SETTLED');

CREATE TABLE "Receivable" (
  "id" TEXT NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "status" "ReceivableStatus" NOT NULL DEFAULT 'OPEN',
  "note" TEXT,
  "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "settledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Receivable_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Transaction" RENAME COLUMN "linkedItemId" TO "accountId";
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Transaction_accountId_idx" ON "Transaction"("accountId");

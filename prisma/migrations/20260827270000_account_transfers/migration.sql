-- #138 (Transfer schema + link/unlink actions) — see docs/adr/0013-account-transfers-and-statement-upload-fixes.md.
--
-- A third reclassification type alongside Receivable and GoalContribution: links two
-- Transactions (one OUT, one IN, on two different Accounts) as the same money moving
-- between the user's own accounts. No amount/date of its own — both already live on the
-- two linked Transactions. Transaction.transferId is nullable and non-unique for the same
-- reason receivableId is: it references exactly one of the Transfer's two linked
-- Transactions, not a single row.

CREATE TABLE "Transfer" (
  "id" TEXT NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Transfer_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Transaction" ADD COLUMN "transferId" TEXT;

CREATE INDEX "Transaction_transferId_idx" ON "Transaction"("transferId");

ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_transferId_fkey"
  FOREIGN KEY ("transferId") REFERENCES "Transfer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

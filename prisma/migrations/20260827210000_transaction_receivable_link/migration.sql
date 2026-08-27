-- #114 (Receivable reclassification) — see docs/adr/0010-v2-phase5-finances.md.
--
-- Adds Transaction.receivableId, a nullable, non-unique FK to Receivable. Not unique
-- because the same Receivable can be referenced by two different transactions: the
-- funding OUT transaction ("this became a receivable") and an optional repayment IN
-- transaction settling it later.

ALTER TABLE "Transaction" ADD COLUMN "receivableId" TEXT;

CREATE INDEX "Transaction_receivableId_idx" ON "Transaction"("receivableId");

ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_receivableId_fkey"
  FOREIGN KEY ("receivableId") REFERENCES "Receivable"("id") ON DELETE SET NULL ON UPDATE CASCADE;

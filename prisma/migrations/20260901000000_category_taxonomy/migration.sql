-- #147 (Category taxonomy) — see docs/adr/0015-finance-data-integrity-and-transaction-browsing.md.
--
-- Replaces Transaction.category (free text, populated by two independent
-- unvalidated sources — manual entry and Gemini's statement-extraction
-- guess) with a real, user-editable Category table. Pre-seeds the
-- existing default set, then backfills a Category for every distinct
-- existing Transaction.category string (case-insensitive match against
-- an already-seeded/created Category, so "food" and "Food" collapse onto
-- one row) before finally dropping the old string column.

CREATE TABLE "Category" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");

INSERT INTO "Category" ("id", "name", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'Housing', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Food', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Transport', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Shopping', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Entertainment', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Other', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;

-- Backfill a Category for every existing Transaction.category string with
-- no case-insensitive match yet (e.g. a category the user typed past the
-- old suggestion list). DISTINCT ON (lower(category)) collapses same-batch
-- case variants ("Food"/"food") down to one representative row BEFORE the
-- insert — a plain "INSERT ... SELECT WHERE NOT EXISTS" would miss this:
-- every row in one INSERT statement sees the same pre-statement snapshot
-- of Category, so "Food" and "food" would each independently pass
-- NOT EXISTS and both get inserted, defeating the case-insensitive
-- collapse this migration exists to do.
INSERT INTO "Category" ("id", "name", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, picked."category", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (
  SELECT DISTINCT ON (lower(t."category")) t."category"
  FROM "Transaction" t
  ORDER BY lower(t."category"), t."category"
) picked
WHERE NOT EXISTS (
  SELECT 1 FROM "Category" c WHERE lower(c."name") = lower(picked."category")
);

ALTER TABLE "Transaction" ADD COLUMN "categoryId" TEXT;

UPDATE "Transaction" t
SET "categoryId" = c."id"
FROM "Category" c
WHERE lower(c."name") = lower(t."category");

ALTER TABLE "Transaction" ALTER COLUMN "categoryId" SET NOT NULL;

CREATE INDEX "Transaction_categoryId_idx" ON "Transaction"("categoryId");

ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Transaction" DROP COLUMN "category";

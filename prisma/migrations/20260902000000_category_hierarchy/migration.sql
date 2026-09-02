-- #173 (Category hierarchy) — see #172, docs/adr/0015-finance-data-integrity-and-transaction-browsing.md.
--
-- Replaces the flat, user-editable Category taxonomy (#147) — which had
-- fragmented into ~40 near-duplicate categories over time — with a fixed,
-- system-managed two-level hierarchy (parentId null = top-level,
-- parentId set = a subcategory under it). The user has already deleted
-- every Transaction, so there is nothing to backfill: every existing
-- Category row is simply deleted and replaced by the seeded hierarchy.

ALTER TABLE "Category" ADD COLUMN "parentId" TEXT;

ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_fkey"
  FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "Category_parentId_idx" ON "Category"("parentId");

-- The old global "name" uniqueness no longer fits — the same subcategory
-- name could in principle appear under two different parents. Replace it
-- with per-parent uniqueness, plus a separate partial index keeping
-- top-level names unique among themselves (a plain (parentId, name)
-- unique constraint doesn't cover this: Postgres treats every NULL
-- parentId as distinct for uniqueness purposes, so two top-level rows
-- named "Housing" wouldn't collide under that constraint alone).
DROP INDEX "Category_name_key";

CREATE UNIQUE INDEX "Category_parentId_name_key" ON "Category"("parentId", "name");

CREATE UNIQUE INDEX "Category_topLevel_name_key" ON "Category"("name") WHERE "parentId" IS NULL;

-- Clean slate: no Transaction references any Category right now (the
-- user deleted all transactions before this migration), so every
-- existing category can simply be removed before seeding the new set.
DELETE FROM "Category";

-- Seed the 11 top-level categories, then their subcategories in a second
-- pass once the parents' generated ids exist to reference.
INSERT INTO "Category" ("id", "name", "parentId", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'Housing', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Food', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Transport', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Shopping', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Entertainment', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Health', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Travel', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Bills', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Income', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Transfers', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Other', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO "Category" ("id", "name", "parentId", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, sub.name, parent.id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (VALUES
  ('Housing', 'Rent/Mortgage'),
  ('Housing', 'Utilities'),
  ('Housing', 'Home Insurance'),
  ('Housing', 'Maintenance & Repairs'),
  ('Food', 'Groceries'),
  ('Food', 'Dining Out'),
  ('Food', 'Coffee & Takeaway'),
  ('Transport', 'Fuel'),
  ('Transport', 'Public Transport'),
  ('Transport', 'Parking & Tolls'),
  ('Transport', 'Vehicle Maintenance'),
  ('Shopping', 'Clothing'),
  ('Shopping', 'Electronics'),
  ('Shopping', 'Household Goods'),
  ('Shopping', 'General'),
  ('Entertainment', 'Streaming & Subscriptions'),
  ('Entertainment', 'Events & Outings'),
  ('Entertainment', 'Hobbies'),
  ('Health', 'Medical'),
  ('Health', 'Fitness'),
  ('Health', 'Personal Care'),
  ('Travel', 'Flights & Transport'),
  ('Travel', 'Accommodation'),
  ('Travel', 'General'),
  ('Bills', 'Phone & Internet'),
  ('Bills', 'Insurance (non-home)'),
  ('Bills', 'Memberships'),
  ('Income', 'Salary'),
  ('Income', 'Transfers In'),
  ('Income', 'Other Income'),
  ('Transfers', 'Internal Transfers'),
  ('Transfers', 'Savings'),
  ('Other', 'Uncategorized')
) AS sub(parentName, name)
JOIN "Category" parent ON parent.name = sub.parentName AND parent."parentId" IS NULL;

-- #123 (Budget vs. actual) — see docs/adr/0010-v2-phase5-finances.md.
--
-- A standing per-category monthly spending limit — one row per category, not month-scoped
-- (no rollover), read fresh against each month's actual spend at query time.

CREATE TABLE "Budget" (
  "id" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "limit" DECIMAL(12,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Budget_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Budget_category_key" ON "Budget"("category");

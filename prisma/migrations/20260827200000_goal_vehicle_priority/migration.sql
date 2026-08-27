-- v2 Phase 5 (Finances) — see #112/#119 and docs/adr/0010-v2-phase5-finances.md
--
-- Goal gains a savings-vehicle type (a label only, no cap/bonus rules enforced) and an
-- explicit, user-editable priority rank — the user's real priority order (Emergency fund
-- -> LISA -> wedding -> S&S ISA) has somewhere to live. Existing Goals default to GENERIC
-- and priority 0 (equal-ranked, stable sort keeps their prior order until reordered).

CREATE TYPE "GoalVehicle" AS ENUM ('EMERGENCY_FUND', 'LISA', 'PENSION', 'STOCKS_ISA', 'CASH_ISA', 'GENERIC');

ALTER TABLE "Goal"
  ADD COLUMN "vehicle" "GoalVehicle" NOT NULL DEFAULT 'GENERIC',
  ADD COLUMN "priority" INTEGER NOT NULL DEFAULT 0;

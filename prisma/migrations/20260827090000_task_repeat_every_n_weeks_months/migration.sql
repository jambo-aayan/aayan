-- v2 Phase 2 (Habits and Tasks) — see docs/adr/0006-v2-phase2-habits-tasks.md
--
-- Task recurrence grows two new rules, both reusing the existing
-- repeatIntervalN column (see Task's schema comment) — no new column, no
-- data reshape. No existing Task row can already hold either new value, so
-- there is nothing to backfill.

ALTER TYPE "TaskRepeatRule" ADD VALUE 'EVERY_N_WEEKS';
ALTER TYPE "TaskRepeatRule" ADD VALUE 'EVERY_N_MONTHS';

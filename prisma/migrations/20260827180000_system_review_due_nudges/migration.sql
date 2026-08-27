-- Systems polish follow-up — see #109/#111 and docs/adr/0009-systems-review-nudges.md
--
-- A new Nudge type for an Active Experiment whose review date has arrived
-- with no verdict yet, and a new target type referencing the eligible
-- System's own row. No existing Nudge row can already hold either new
-- value, so there is nothing to backfill.

ALTER TYPE "NudgeType" ADD VALUE 'SYSTEM_REVIEW_DUE';
ALTER TYPE "NudgeTargetType" ADD VALUE 'SYSTEM';

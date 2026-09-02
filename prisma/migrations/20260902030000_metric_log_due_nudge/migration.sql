-- #186 — a new Nudge type for a required DAILY/WEEKLY Metric with no
-- entry for its current period, past its cadence deadline (end of day
-- for DAILY, end of week for WEEKLY). Uses the existing NONE targetType,
-- same as METRIC_OFF_TARGET/CATEGORY_SPEND_ANOMALY — there's no single
-- entity to link to. No existing Nudge row can already hold this value,
-- so there is nothing to backfill.

ALTER TYPE "NudgeType" ADD VALUE 'METRIC_LOG_DUE';

-- #179 — a new Nudge type for a leaf category running notably above its
-- own trailing-3-month baseline this month (ADR-0012's spend-deviation
-- math). Uses the existing NONE targetType, same as METRIC_OFF_TARGET —
-- there's no single entity to link to. No existing Nudge row can already
-- hold this value, so there is nothing to backfill.

ALTER TYPE "NudgeType" ADD VALUE 'CATEGORY_SPEND_ANOMALY';

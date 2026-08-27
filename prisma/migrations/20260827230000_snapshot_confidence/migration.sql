-- #116 (Statement upload, Valuation accounts) — see docs/adr/0010-v2-phase5-finances.md.
--
-- Adds Snapshot.confidence, set only by Valuation statement-upload parsing. Null for a
-- manually entered or Transactional-derived Snapshot, which are never held for review
-- (see lib/finance/logic.ts's isHeldForReview — null short-circuits to "not held").

ALTER TABLE "Snapshot" ADD COLUMN "confidence" DOUBLE PRECISION;

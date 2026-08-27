-- #115 (Statement upload + Gemini parsing, Transactional accounts) — see
-- docs/adr/0010-v2-phase5-finances.md.
--
-- Adds Transaction.confidence, set only by statement-upload parsing. Null for manually
-- entered transactions, which are never held for review (see lib/finance/logic.ts's
-- isHeldForReview — null short-circuits to "not held").

ALTER TABLE "Transaction" ADD COLUMN "confidence" DOUBLE PRECISION;

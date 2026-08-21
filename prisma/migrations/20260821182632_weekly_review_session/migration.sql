-- CreateTable
CREATE TABLE "WeeklyReviewSession" (
    "id" TEXT NOT NULL,
    "step" INTEGER NOT NULL DEFAULT 0,
    "draftDigest" TEXT,
    "verdicts" JSONB NOT NULL DEFAULT '{}',
    "rankOrder" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeeklyReviewSession_pkey" PRIMARY KEY ("id")
);

-- Seed the singleton row up front so concurrent first-reads never race to
-- insert it themselves (same reasoning as AppSettings' migration).
INSERT INTO "WeeklyReviewSession" ("id", "step", "verdicts", "rankOrder", "startedAt", "updatedAt")
VALUES ('weekly-review', 0, '{}', ARRAY[]::TEXT[], CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

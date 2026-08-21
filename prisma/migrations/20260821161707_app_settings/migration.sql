-- CreateTable
CREATE TABLE "AppSettings" (
    "id" TEXT NOT NULL,
    "reduceMotion" BOOLEAN NOT NULL DEFAULT false,
    "emptyAppMode" BOOLEAN NOT NULL DEFAULT false,
    "weeklyReviewPrompt" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSettings_pkey" PRIMARY KEY ("id")
);

-- Seed the singleton row up front so concurrent first-reads (e.g. static
-- prerendering hitting the root layout's getAppSettings() in parallel
-- workers) never race to insert it themselves.
INSERT INTO "AppSettings" ("id", "reduceMotion", "emptyAppMode", "weeklyReviewPrompt", "updatedAt")
VALUES ('app-settings', false, false, true, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

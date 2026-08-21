-- AlterTable
ALTER TABLE "AppSettings" ADD COLUMN     "eveningCheckIn" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "morningBrief" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "streakWarnings" BOOLEAN NOT NULL DEFAULT true;

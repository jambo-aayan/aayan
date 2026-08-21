-- CreateTable
CREATE TABLE "LoginLockout" (
    "id" TEXT NOT NULL,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoginLockout_pkey" PRIMARY KEY ("id")
);

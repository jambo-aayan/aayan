-- CreateTable
CREATE TABLE "Goal" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "target" DECIMAL(12,2) NOT NULL,
    "saved" DECIMAL(12,2) NOT NULL,
    "monthlyContribution" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Goal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceNorthStar" (
    "id" TEXT NOT NULL,
    "target" DECIMAL(12,2),
    "deadline" DATE,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceNorthStar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnableBankingLink" (
    "id" TEXT NOT NULL,
    "aspspName" TEXT NOT NULL,
    "aspspCountry" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "accounts" JSONB NOT NULL,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnableBankingLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EnableBankingLink_sessionId_key" ON "EnableBankingLink"("sessionId");

-- CreateTable
CREATE TABLE "PainMobilityLog" (
    "id" TEXT NOT NULL,
    "areaId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "pain" INTEGER NOT NULL,
    "mobility" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PainMobilityLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PainMobilityLog_areaId_idx" ON "PainMobilityLog"("areaId");

-- CreateIndex
CREATE UNIQUE INDEX "PainMobilityLog_areaId_date_key" ON "PainMobilityLog"("areaId", "date");

-- AddForeignKey
ALTER TABLE "PainMobilityLog" ADD CONSTRAINT "PainMobilityLog_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "Pillar" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "northStar" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pillar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Area" (
    "id" TEXT NOT NULL,
    "pillarId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currentState" TEXT,
    "northStar" TEXT,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Area_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Area_pillarId_idx" ON "Area"("pillarId");

-- AddForeignKey
ALTER TABLE "Area" ADD CONSTRAINT "Area_pillarId_fkey" FOREIGN KEY ("pillarId") REFERENCES "Pillar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

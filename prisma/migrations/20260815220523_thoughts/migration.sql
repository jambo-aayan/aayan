-- CreateTable
CREATE TABLE "Thought" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "pillarId" TEXT,
    "areaId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Thought_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Thought_pillarId_idx" ON "Thought"("pillarId");

-- CreateIndex
CREATE INDEX "Thought_areaId_idx" ON "Thought"("areaId");

-- AddForeignKey
ALTER TABLE "Thought" ADD CONSTRAINT "Thought_pillarId_fkey" FOREIGN KEY ("pillarId") REFERENCES "Pillar"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Thought" ADD CONSTRAINT "Thought_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE SET NULL ON UPDATE CASCADE;

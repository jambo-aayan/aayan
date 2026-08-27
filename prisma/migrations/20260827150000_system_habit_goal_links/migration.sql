-- CreateTable
CREATE TABLE "SystemHabit" (
    "systemId" TEXT NOT NULL,
    "habitId" TEXT NOT NULL,

    CONSTRAINT "SystemHabit_pkey" PRIMARY KEY ("systemId","habitId")
);

-- CreateTable
CREATE TABLE "SystemGoal" (
    "systemId" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,

    CONSTRAINT "SystemGoal_pkey" PRIMARY KEY ("systemId","goalId")
);

-- CreateIndex
CREATE INDEX "SystemHabit_habitId_idx" ON "SystemHabit"("habitId");

-- CreateIndex
CREATE INDEX "SystemGoal_goalId_idx" ON "SystemGoal"("goalId");

-- AddForeignKey
ALTER TABLE "SystemHabit" ADD CONSTRAINT "SystemHabit_systemId_fkey" FOREIGN KEY ("systemId") REFERENCES "System"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SystemHabit" ADD CONSTRAINT "SystemHabit_habitId_fkey" FOREIGN KEY ("habitId") REFERENCES "Habit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SystemGoal" ADD CONSTRAINT "SystemGoal_systemId_fkey" FOREIGN KEY ("systemId") REFERENCES "System"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SystemGoal" ADD CONSTRAINT "SystemGoal_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "LifeGoal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

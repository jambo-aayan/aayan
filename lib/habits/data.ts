import "server-only";
import { prisma } from "@/lib/prisma";
import { isSameUtcDay } from "./date-utils";

export async function getHabitsForArea(areaId: string) {
  const habits = await prisma.habit.findMany({
    where: { areaId },
    include: { checkIns: true },
    orderBy: { createdAt: "asc" },
  });
  return habits.map(({ checkIns, ...habit }) => ({
    ...habit,
    checkInDates: checkIns.map((c) => c.date),
    todayLevel: checkIns.find((c) => isSameUtcDay(c.date, new Date()))?.level ?? null,
  }));
}

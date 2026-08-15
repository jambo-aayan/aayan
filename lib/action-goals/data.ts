import "server-only";
import { prisma } from "@/lib/prisma";
import { isSameUtcDay } from "@/lib/habits/date-utils";

export async function getActionGoalsForArea(areaId: string) {
  return prisma.actionGoal.findMany({ where: { areaId }, orderBy: { createdAt: "asc" } });
}

export async function getMyDayHabits() {
  const habits = await prisma.habit.findMany({
    where: { active: true },
    include: { checkIns: true, area: true },
    orderBy: { createdAt: "asc" },
  });
  return habits.map(({ checkIns, area, ...habit }) => ({
    ...habit,
    areaName: area.name,
    checkInDates: checkIns.map((c) => c.date),
    todayLevel: checkIns.find((c) => isSameUtcDay(c.date, new Date()))?.level ?? null,
  }));
}

export async function getMyDayGoals() {
  const goals = await prisma.actionGoal.findMany({
    where: { myday: true },
    include: { area: true },
    orderBy: { createdAt: "asc" },
  });
  return goals.map(({ area, ...goal }) => ({ ...goal, areaName: area.name }));
}

/** All non-myday Goals across every Area — the cross-cutting backlog. */
export async function getAllActionsGoals() {
  const goals = await prisma.actionGoal.findMany({
    where: { myday: false },
    include: { area: true },
    orderBy: { createdAt: "asc" },
  });
  return goals.map(({ area, ...goal }) => ({ ...goal, areaName: area.name }));
}

/** Every Goal across every Area, myday or not — the shared source for the
 * Today view's "myday or due today" filter and the By Date grouping. */
export async function getEveryGoal() {
  const goals = await prisma.actionGoal.findMany({ include: { area: true }, orderBy: { createdAt: "asc" } });
  return goals.map(({ area, ...goal }) => ({ ...goal, areaName: area.name }));
}

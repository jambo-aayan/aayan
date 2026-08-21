import "server-only";
import { prisma } from "@/lib/prisma";
import { dailyStreak, weeklyStreak } from "@/lib/habits/streak";
import { isSameUtcDay } from "@/lib/habits/date-utils";

export type LifeGoalStatus = "ACTIVE" | "PAUSED" | "COMPLETED" | "ARCHIVED";

const GOAL_INCLUDE = {
  pillar: { select: { id: true, name: true, color: true } },
  area: { select: { id: true, name: true } },
  _count: { select: { habits: true, tasks: { where: { status: "ACTIVE" } } } },
} as const;

function mapGoal(row: {
  id: string;
  name: string;
  status: LifeGoalStatus;
  pillarId: string;
  pillar: { id: string; name: string; color: string | null };
  areaId: string | null;
  area: { id: string; name: string } | null;
  createdAt: Date;
  updatedAt: Date;
  _count: { habits: number; tasks: number };
}) {
  const { pillar, area, _count, ...goal } = row;
  return {
    ...goal,
    pillarName: pillar.name,
    pillarColor: pillar.color,
    areaName: area?.name ?? null,
    habitCount: _count.habits,
    openTaskCount: _count.tasks,
  };
}

export type LifeGoalWithRelations = ReturnType<typeof mapGoal>;

export type LifeGoalFilter = { pillarId?: string; areaId?: string; status?: LifeGoalStatus };

export async function getAllGoals(filter: LifeGoalFilter = {}): Promise<LifeGoalWithRelations[]> {
  const where: Record<string, unknown> = {};
  if (filter.pillarId) where.pillarId = filter.pillarId;
  if (filter.areaId) where.areaId = filter.areaId;
  if (filter.status) where.status = filter.status;

  const goals = await prisma.lifeGoal.findMany({
    where,
    include: GOAL_INCLUDE,
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
  });
  return goals.map(mapGoal);
}

export async function getGoalsForArea(areaId: string): Promise<LifeGoalWithRelations[]> {
  return getAllGoals({ areaId });
}

export async function getGoalOptions(
  pillarId?: string
): Promise<{ id: string; name: string; areaId: string | null; pillarId: string }[]> {
  const goals = await prisma.lifeGoal.findMany({
    where: { status: { in: ["ACTIVE", "PAUSED"] }, ...(pillarId ? { pillarId } : {}) },
    select: { id: true, name: true, areaId: true, pillarId: true },
    orderBy: { name: "asc" },
  });
  return goals;
}

export async function getGoalById(id: string): Promise<LifeGoalWithRelations | null> {
  const goal = await prisma.lifeGoal.findUnique({ where: { id }, include: GOAL_INCLUDE });
  return goal ? mapGoal(goal) : null;
}

/** Everything linked to one Goal, for its detail page — Tasks it's tied to
 * directly, and Habits (split by whether they're currently Active/Paused)
 * that name it as one of their Goals. Queried live through the
 * relationships, never duplicated onto the Goal row itself. */
export async function getGoalDetail(id: string) {
  const goal = await getGoalById(id);
  if (!goal) return null;

  const [tasks, habitLinks] = await Promise.all([
    prisma.task.findMany({
      where: { goalId: id, deletedAt: null },
      include: { list: { select: { id: true, name: true } }, tags: { include: { tag: true } } },
      orderBy: [{ status: "asc" }, { createdAt: "asc" }],
    }),
    prisma.habitGoal.findMany({
      where: { goalId: id },
      include: {
        habit: {
          select: {
            id: true,
            name: true,
            status: true,
            areaId: true,
            scheduleType: true,
            checkIns: { select: { date: true, level: true } },
          },
        },
      },
    }),
  ]);

  return {
    goal,
    tasks: tasks.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      important: t.important,
      dueDate: t.dueDate,
      listName: t.list?.name ?? null,
      tags: t.tags.map((tt) => tt.tag.name),
    })),
    habits: habitLinks.map((h) => {
      const checkInDates = h.habit.checkIns.map((c) => c.date);
      const streak = h.habit.scheduleType === "WEEKLY" ? weeklyStreak(checkInDates) : dailyStreak(checkInDates);
      const todayLevel = h.habit.checkIns.find((c) => isSameUtcDay(c.date, new Date()))?.level ?? null;
      return { id: h.habit.id, name: h.habit.name, status: h.habit.status, isPrimary: h.isPrimary, streak, todayLevel };
    }),
  };
}

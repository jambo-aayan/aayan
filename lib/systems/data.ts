import "server-only";
import { prisma } from "@/lib/prisma";

const SYSTEM_INCLUDE = {
  steps: {
    orderBy: { sortOrder: "asc" as const },
    include: { occurrences: { orderBy: { occurredOn: "asc" as const } } },
  },
  children: { select: { id: true, name: true, state: true } },
  decisions: { orderBy: { when: "desc" as const } },
  habits: {
    include: {
      habit: { select: { id: true, name: true, status: true, checkIns: { select: { date: true } } } },
    },
  },
  goals: {
    include: { goal: { select: { id: true, name: true, status: true } } },
  },
};

type RawSystem = Awaited<ReturnType<typeof prisma.system.findFirstOrThrow<{ include: typeof SYSTEM_INCLUDE }>>>;

/** Flattens the SystemHabit/SystemGoal join rows into the plain
 * `linkedHabits`/`linkedGoals` shape components consume — everything
 * else on the row already matches its column names 1:1. */
function mapSystem(row: RawSystem) {
  const { habits, goals, ...rest } = row;
  return {
    ...rest,
    linkedHabits: habits.map((h) => ({
      id: h.habit.id,
      name: h.habit.name,
      status: h.habit.status,
      checkInDates: h.habit.checkIns.map((c) => c.date),
    })),
    linkedGoals: goals.map((g) => ({ id: g.goal.id, name: g.goal.name, status: g.goal.status })),
  };
}

export type SystemWithSteps = ReturnType<typeof mapSystem>;

export async function getSystemsForArea(areaId: string) {
  const systems = await prisma.system.findMany({
    where: { areaId, templateId: null },
    include: SYSTEM_INCLUDE,
    orderBy: { createdAt: "asc" },
  });
  return systems.map(mapSystem);
}

export async function getSystemsForPillar(pillarId: string) {
  const systems = await prisma.system.findMany({
    where: { pillarId, areaId: null, templateId: null },
    include: SYSTEM_INCLUDE,
    orderBy: { createdAt: "asc" },
  });
  return systems.map(mapSystem);
}

export async function getSystem(id: string) {
  const system = await prisma.system.findUnique({ where: { id }, include: SYSTEM_INCLUDE });
  return system ? mapSystem(system) : null;
}

/** Habits within the System's own Pillar — a System only serves Habits it
 * shares a Pillar with, same scoping as Habit<->LifeGoal linkage. */
export async function getHabitOptionsForPillar(pillarId: string) {
  return prisma.habit.findMany({
    where: { pillarId, status: { in: ["ACTIVE", "PAUSED"] } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

export type UpcomingSystemStep = {
  id: string;
  text: string;
  date: Date;
  systemId: string;
  systemName: string;
  areaId: string | null;
  pillarId: string;
};

/** Dated steps (a Checkpoint target date or a Dated milestone) approaching
 * within `withinDays`, for My Day's Upcoming section — reusing the same
 * due-date surface Tasks already use, not a new reminder mechanism
 * (DATA_MODEL.md §5). */
export async function getUpcomingSystemSteps(from: Date, withinDays: number): Promise<UpcomingSystemStep[]> {
  const until = new Date(from);
  until.setDate(until.getDate() + withinDays);

  const steps = await prisma.systemStep.findMany({
    where: {
      done: false,
      OR: [
        { type: "CHECKPOINT", targetDate: { gte: from, lte: until } },
        { type: "MILESTONE", date: { gte: from, lte: until } },
      ],
    },
    include: { system: { select: { id: true, name: true, areaId: true, pillarId: true } } },
    orderBy: { sortOrder: "asc" },
  });

  return steps
    .map((s) => ({
      id: s.id,
      text: s.text,
      date: (s.targetDate ?? s.date)!,
      systemId: s.system.id,
      systemName: s.system.name,
      areaId: s.system.areaId,
      pillarId: s.system.pillarId,
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

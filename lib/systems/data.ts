import "server-only";
import { prisma } from "@/lib/prisma";

const SYSTEM_INCLUDE = {
  steps: {
    orderBy: { sortOrder: "asc" as const },
    include: { occurrences: { orderBy: { occurredOn: "asc" as const } } },
  },
  children: { select: { id: true, name: true, state: true } },
  decisions: { orderBy: { when: "desc" as const } },
};

export type SystemWithSteps = Awaited<ReturnType<typeof getSystemsForArea>>[number];

export async function getSystemsForArea(areaId: string) {
  return prisma.system.findMany({
    where: { areaId, templateId: null },
    include: SYSTEM_INCLUDE,
    orderBy: { createdAt: "asc" },
  });
}

export async function getSystemsForPillar(pillarId: string) {
  return prisma.system.findMany({
    where: { pillarId, areaId: null, templateId: null },
    include: SYSTEM_INCLUDE,
    orderBy: { createdAt: "asc" },
  });
}

export async function getSystem(id: string) {
  return prisma.system.findUnique({ where: { id }, include: SYSTEM_INCLUDE });
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

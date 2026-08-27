import "server-only";
import { prisma } from "@/lib/prisma";

const SYSTEM_INCLUDE = {
  steps: { orderBy: { sortOrder: "asc" as const } },
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

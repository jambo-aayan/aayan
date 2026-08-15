import "server-only";
import { prisma } from "@/lib/prisma";
import { ensureHealthAreasSeeded } from "./ensure-seeded";
import { HEALTH_PILLAR_ID } from "./seed-data";

export async function getHealthPillarWithAreas() {
  await ensureHealthAreasSeeded();
  return prisma.pillar.findUniqueOrThrow({
    where: { id: HEALTH_PILLAR_ID },
    include: { areas: { orderBy: { sortOrder: "asc" } } },
  });
}

export async function getArea(areaId: string) {
  await ensureHealthAreasSeeded();
  return prisma.area.findUnique({ where: { id: areaId } });
}

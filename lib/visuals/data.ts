import "server-only";
import { prisma } from "@/lib/prisma";

/** Every Visual on a Pillar's own Charts/Table zones (#161/#162) — exact
 * scope (areaId null), same pattern as getSystemsForPillar: a Visual
 * belonging to one of the Pillar's Areas shows on that Area's page instead,
 * never pooled onto the Pillar page too. */
export async function getVisualsForPillar(pillarId: string) {
  return prisma.visual.findMany({
    where: { pillarId, areaId: null },
    orderBy: { sortOrder: "asc" },
  });
}

export async function getVisualsForArea(areaId: string) {
  return prisma.visual.findMany({
    where: { areaId },
    orderBy: { sortOrder: "asc" },
  });
}

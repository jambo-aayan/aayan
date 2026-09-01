import "server-only";
import { prisma } from "@/lib/prisma";

/** Every Visual on a Pillar's own Charts/Table zones (#161/#162) — exact
 * scope (areaId null), same pattern as getSystemsForPillar: a Visual
 * belonging to one of the Pillar's Areas shows on that Area's page instead,
 * never pooled onto the Pillar page too. Includes `records` (#163) so an
 * ad-hoc chart's data is available without a second round-trip, and so a
 * deleted Visual's records are on hand client-side for undo (see
 * restoreVisual). */
export async function getVisualsForPillar(pillarId: string) {
  return prisma.visual.findMany({
    where: { pillarId, areaId: null },
    orderBy: { sortOrder: "asc" },
    include: { records: { orderBy: { date: "asc" } } },
  });
}

export async function getVisualsForArea(areaId: string) {
  return prisma.visual.findMany({
    where: { areaId },
    orderBy: { sortOrder: "asc" },
    include: { records: { orderBy: { date: "asc" } } },
  });
}

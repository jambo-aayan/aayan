import "server-only";
import { prisma } from "@/lib/prisma";
import { resolveVisualBindings } from "./resolve-binding";
import { resolveTableBindings } from "./resolve-table-binding";

const VISUAL_INCLUDE = {
  records: { orderBy: { date: "asc" as const } },
  columns: { orderBy: { sortOrder: "asc" as const } },
  rows: { orderBy: { sortOrder: "asc" as const } },
};

/** Every Visual on a Pillar's own Charts/Table zones (#161/#162) — exact
 * scope (areaId null), same pattern as getSystemsForPillar: a Visual
 * belonging to one of the Pillar's Areas shows on that Area's page instead,
 * never pooled onto the Pillar page too. Includes `records` (#163) so an
 * ad-hoc chart's data is available without a second round-trip, and so a
 * deleted Visual's records are on hand client-side for undo (see
 * restoreVisual); `columns`/`rows` (#168) do the same for a freeform
 * Table, empty arrays for every chart type. resolveVisualBindings (#166)
 * then replaces a bound chart's records with its live source data, and
 * resolveTableBindings (#169) replaces a bound table's rows with the
 * adapter's live entity list — both are no-ops for every ad-hoc/freeform
 * Visual, which is most of them. */
export async function getVisualsForPillar(pillarId: string) {
  const visuals = await prisma.visual.findMany({
    where: { pillarId, areaId: null },
    orderBy: { sortOrder: "asc" },
    include: VISUAL_INCLUDE,
  });
  return resolveTableBindings(await resolveVisualBindings(visuals));
}

export async function getVisualsForArea(areaId: string) {
  const visuals = await prisma.visual.findMany({
    where: { areaId },
    orderBy: { sortOrder: "asc" },
    include: VISUAL_INCLUDE,
  });
  return resolveTableBindings(await resolveVisualBindings(visuals));
}

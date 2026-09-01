import "server-only";
import { prisma } from "@/lib/prisma";

/** Generalized off the original Health-only `getArea` in lib/health/data.ts
 * (#157/ADR-0016) — Area reads are no longer Health-specific. Every
 * Pillar's ensure-seeded call already runs upstream in the shell layout,
 * so this doesn't need to run one itself. */
export async function getArea(areaId: string) {
  return prisma.area.findUnique({ where: { id: areaId } });
}

import "server-only";
import { prisma } from "@/lib/prisma";
import { ensureHealthAreasSeeded } from "@/lib/health/ensure-seeded";
import { ensureFinancePillarSeeded } from "@/lib/finance/ensure-seeded";
import { ensureMiscellaneousPillarSeeded } from "@/lib/miscellaneous/ensure-seeded";
import { ensureDerivedFieldHabitsSeeded } from "@/lib/habits/derived-field-seed";

export type PillarWithStats = {
  id: string;
  name: string;
  color: string | null;
  desc: string | null;
  intendedTimeShare: number | null;
  areaCount: number;
  habitCount: number;
};

export async function getPillarsWithStats(): Promise<PillarWithStats[]> {
  await ensureHealthAreasSeeded();
  await ensureFinancePillarSeeded();
  await ensureMiscellaneousPillarSeeded();
  // Depends on Health's Pillar/Areas existing (FK) — must run after
  // ensureHealthAreasSeeded.
  await ensureDerivedFieldHabitsSeeded();

  const pillars = await prisma.pillar.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { areas: true, habits: true } } },
  });

  return pillars.map((p) => ({
    id: p.id,
    name: p.name,
    color: p.color,
    desc: p.desc,
    intendedTimeShare: p.intendedTimeShare,
    areaCount: p._count.areas,
    habitCount: p._count.habits,
  }));
}

/** Generalized off the original Health-only `getHealthPillarWithAreas`
 * (#157/ADR-0016) — every Pillar's ensure-seeded call already runs upstream
 * in the shell layout (see getPillarsWithStats's own Promise.all), so this
 * doesn't need to run one itself. Returns null for an unknown id — the
 * generic /[pillarId] route calls notFound() rather than throwing, unlike
 * the old Health-only findUniqueOrThrow (Health's id is always guaranteed
 * present, an arbitrary pillarId isn't). */
export async function getPillarWithAreas(pillarId: string) {
  return prisma.pillar.findUnique({
    where: { id: pillarId },
    include: { areas: { orderBy: { sortOrder: "asc" } } },
  });
}

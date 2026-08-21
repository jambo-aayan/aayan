import "server-only";
import { prisma } from "@/lib/prisma";
import { ensureHealthAreasSeeded } from "@/lib/health/ensure-seeded";
import { ensureFinancePillarSeeded } from "@/lib/finance/ensure-seeded";

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

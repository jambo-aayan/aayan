import "server-only";
import { prisma } from "@/lib/prisma";

export async function getAllThoughts() {
  const thoughts = await prisma.thought.findMany({
    include: { pillar: { select: { name: true } }, area: { select: { name: true } } },
    orderBy: { date: "desc" },
  });
  return thoughts.map(({ pillar, area, ...thought }) => ({
    ...thought,
    tagName: area?.name ?? pillar?.name ?? null,
  }));
}

/** Every Pillar and Area, for the quick-add's optional tag dropdown. */
export async function getTagOptions() {
  const pillars = await prisma.pillar.findMany({
    include: { areas: { orderBy: { sortOrder: "asc" } } },
    orderBy: { name: "asc" },
  });
  return pillars.map((p) => ({
    id: p.id,
    name: p.name,
    areas: p.areas.map((a) => ({ id: a.id, name: a.name })),
  }));
}

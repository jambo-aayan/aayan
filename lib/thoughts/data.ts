import "server-only";
import { prisma } from "@/lib/prisma";

const THOUGHT_INCLUDE = {
  pillar: { select: { name: true, color: true } },
  area: { select: { name: true, pillar: { select: { color: true } } } },
} as const;

function mapThought<T extends { pillar: { name: string; color: string | null } | null; area: { name: string; pillar: { color: string | null } } | null }>({
  pillar,
  area,
  ...thought
}: T) {
  return {
    ...thought,
    tagName: area?.name ?? pillar?.name ?? null,
    tagColor: area?.pillar.color ?? pillar?.color ?? null,
  };
}

export async function getAllThoughts() {
  const thoughts = await prisma.thought.findMany({
    include: THOUGHT_INCLUDE,
    orderBy: { date: "desc" },
  });
  return thoughts.map(mapThought);
}

/** Pillar-scoped for the generic Pillar page's Thoughts section
 * (#158/ADR-0016) — includes Thoughts tagged directly to the Pillar AND
 * ones tagged to any Area under it, since a Thought is one-or-neither
 * (see lib/thoughts/actions.ts) and an Area-tagged Thought about, say,
 * Sleep is still a Health Thought as far as this section is concerned. */
export async function getThoughtsForPillar(pillarId: string) {
  const thoughts = await prisma.thought.findMany({
    where: { OR: [{ pillarId }, { area: { pillarId } }] },
    include: THOUGHT_INCLUDE,
    orderBy: { date: "desc" },
  });
  return thoughts.map(mapThought);
}

export async function getThoughtsForArea(areaId: string) {
  const thoughts = await prisma.thought.findMany({
    where: { areaId },
    include: THOUGHT_INCLUDE,
    orderBy: { date: "desc" },
  });
  return thoughts.map(mapThought);
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

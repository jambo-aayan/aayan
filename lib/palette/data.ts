import "server-only";
import { prisma } from "@/lib/prisma";
import { resolveColorHex, type ColorKey } from "@/lib/colors";
import type { PaletteItem } from "./types";

const PER_DOMAIN_LIMIT = 200;

/** Flat, pre-resolved fixture list for the command palette's client-side
 * substring search — see lib/palette/search.ts. Fetched once per shell
 * render rather than per keystroke (there's no separate search
 * index/service, per the design_handoff_aayan README's Command palette
 * spec). Task/Habit/Goal hits route to their list/detail page rather than
 * deep-linking into a specific row — the app has no route for "open this
 * task's detail sheet" outside its owning list yet. */
export async function getPaletteItems(): Promise<PaletteItem[]> {
  const [tasks, habits, goals, thoughts] = await Promise.all([
    prisma.task.findMany({
      where: { status: "ACTIVE", archivedAt: null, deletedAt: null },
      select: { id: true, title: true, pillar: { select: { color: true } } },
      orderBy: { updatedAt: "desc" },
      take: PER_DOMAIN_LIMIT,
    }),
    prisma.habit.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true, pillar: { select: { color: true } } },
      take: PER_DOMAIN_LIMIT,
    }),
    prisma.lifeGoal.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true, pillar: { select: { color: true } } },
      take: PER_DOMAIN_LIMIT,
    }),
    prisma.thought.findMany({
      select: { id: true, text: true, pillar: { select: { color: true } } },
      orderBy: { createdAt: "desc" },
      take: PER_DOMAIN_LIMIT,
    }),
  ]);

  return [
    ...tasks.map(
      (t): PaletteItem => ({
        id: t.id,
        type: "task",
        label: t.title,
        hint: null,
        href: "/all-tasks",
        color: resolveColorHex(t.pillar?.color as ColorKey | null),
      })
    ),
    ...habits.map(
      (h): PaletteItem => ({
        id: h.id,
        type: "habit",
        label: h.name,
        hint: null,
        href: "/habits",
        color: resolveColorHex(h.pillar?.color as ColorKey | null),
      })
    ),
    ...goals.map(
      (g): PaletteItem => ({
        id: g.id,
        type: "goal",
        label: g.name,
        hint: null,
        href: `/goals/${g.id}`,
        color: resolveColorHex(g.pillar?.color as ColorKey | null),
      })
    ),
    ...thoughts.map(
      (t): PaletteItem => ({
        id: t.id,
        type: "thought",
        label: t.text,
        hint: null,
        href: "/thoughts",
        color: resolveColorHex(t.pillar?.color as ColorKey | null),
      })
    ),
  ];
}

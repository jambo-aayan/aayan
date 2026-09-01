"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { pillarHref } from "@/lib/pillars/nav";
import type { SectionConfigEntry } from "./sections";

export type ActionResult = { ok: true } | { ok: false; error: string };

/** Persists a Pillar page's section order/visibility (#160/ADR-0016) —
 * the full resolved list is saved wholesale on every toggle/reorder, same
 * "read/written as one blob" pattern as WeeklyReviewSession's rankOrder/
 * verdicts (see lib/weekly-review/actions.ts's setReviewRankOrder). */
export async function updatePillarSectionConfig(pillarId: string, config: SectionConfigEntry[]): Promise<ActionResult> {
  try {
    await prisma.pillar.update({ where: { id: pillarId }, data: { sectionConfig: config } });
  } catch {
    return { ok: false, error: "Couldn't save — try again." };
  }
  revalidatePath(pillarHref(pillarId));
  return { ok: true };
}

export async function updateAreaSectionConfig(
  pillarId: string,
  areaId: string,
  config: SectionConfigEntry[]
): Promise<ActionResult> {
  try {
    await prisma.area.update({ where: { id: areaId }, data: { sectionConfig: config } });
  } catch {
    return { ok: false, error: "Couldn't save — try again." };
  }
  revalidatePath(`${pillarHref(pillarId)}/${areaId}`);
  return { ok: true };
}

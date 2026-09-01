"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { ColorKey } from "@/lib/colors";

export type ActionResult = { ok: true } | { ok: false; error: string };

/** A Pillar's color propagates to every Area/Goal/Habit/Task pill rendered
 * under it (see lib/colors.ts), so every page that could be showing one of
 * those needs a fresh render — there's no narrower set of paths to bust. */
function revalidatePillarPaths() {
  revalidatePath("/pillars");
  revalidatePath("/today");
  revalidatePath("/tasks");
  revalidatePath("/habits");
  revalidatePath("/goals");
  revalidatePath("/health");
}

export async function updatePillarColor(pillarId: string, color: ColorKey | null): Promise<ActionResult> {
  try {
    await prisma.pillar.update({ where: { id: pillarId }, data: { color } });
  } catch {
    return { ok: false, error: "Couldn't save — try again." };
  }
  revalidatePillarPaths();
  return { ok: true };
}

export type CreatePillarResult = { ok: true; id: string } | { ok: false; error: string };

/** Per #58's scope (and #49's Out of Scope note): a new Pillar is just its
 * row + a name — plus, as of #156/ADR-0016, a color, so it doesn't sit grey
 * in the nav bar until edited later. Every other field (description, North
 * Star, intended time-share) stays fill-in-later, unchanged. */
export async function createPillar(name: string, color: ColorKey | null = null): Promise<CreatePillarResult> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Give the pillar a name first." };
  try {
    const pillar = await prisma.pillar.create({ data: { id: crypto.randomUUID(), name: trimmed, color } });
    revalidatePillarPaths();
    return { ok: true, id: pillar.id };
  } catch {
    return { ok: false, error: "Couldn't save — try again." };
  }
}

/** The Attention Balance intent input (#49's grilling Q13) — independent
 * per Pillar, no enforced sum-to-100. Null clears it. */
export async function updatePillarTimeShare(pillarId: string, percent: number | null): Promise<ActionResult> {
  if (percent !== null && (percent < 0 || percent > 100)) {
    return { ok: false, error: "Enter a percentage between 0 and 100." };
  }
  try {
    await prisma.pillar.update({ where: { id: pillarId }, data: { intendedTimeShare: percent } });
  } catch {
    return { ok: false, error: "Couldn't save — try again." };
  }
  revalidatePillarPaths();
  return { ok: true };
}

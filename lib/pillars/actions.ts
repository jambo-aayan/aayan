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

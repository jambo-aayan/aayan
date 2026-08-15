"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { HEALTH_PILLAR_ID } from "./seed-data";

export type SaveResult = { ok: true } | { ok: false; error: string };

export async function updateAreaCurrentState(areaId: string, value: string): Promise<SaveResult> {
  try {
    await prisma.area.update({
      where: { id: areaId },
      data: { currentState: value || null },
    });
  } catch {
    return { ok: false, error: "Couldn't save — try again." };
  }
  revalidatePath(`/health/${areaId}`);
  return { ok: true };
}

export async function updateAreaNorthStar(areaId: string, value: string): Promise<SaveResult> {
  try {
    await prisma.area.update({
      where: { id: areaId },
      data: { northStar: value || null },
    });
  } catch {
    return { ok: false, error: "Couldn't save — try again." };
  }
  revalidatePath(`/health/${areaId}`);
  return { ok: true };
}

export async function updateHealthPillarNorthStar(value: string): Promise<SaveResult> {
  try {
    await prisma.pillar.update({
      where: { id: HEALTH_PILLAR_ID },
      data: { northStar: value || null },
    });
  } catch {
    return { ok: false, error: "Couldn't save — try again." };
  }
  revalidatePath("/health");
  return { ok: true };
}

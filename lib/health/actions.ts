"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { HEALTH_PILLAR_ID } from "./seed-data";

export type SaveResult = { ok: true } | { ok: false; error: string };

async function trySave(write: () => Promise<unknown>, revalidate: string): Promise<SaveResult> {
  try {
    await write();
  } catch {
    return { ok: false, error: "Couldn't save — try again." };
  }
  revalidatePath(revalidate);
  return { ok: true };
}

export async function updateAreaCurrentState(areaId: string, value: string): Promise<SaveResult> {
  return trySave(
    () => prisma.area.update({ where: { id: areaId }, data: { currentState: value || null } }),
    `/health/${areaId}`
  );
}

export async function updateAreaNorthStar(areaId: string, value: string): Promise<SaveResult> {
  return trySave(
    () => prisma.area.update({ where: { id: areaId }, data: { northStar: value || null } }),
    `/health/${areaId}`
  );
}

export async function updateHealthPillarNorthStar(value: string): Promise<SaveResult> {
  return trySave(
    () => prisma.pillar.update({ where: { id: HEALTH_PILLAR_ID }, data: { northStar: value || null } }),
    "/health"
  );
}

"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { pillarHref } from "@/lib/pillars/nav";

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

/** Generalized off the original Health-only lib/health/actions.ts
 * (#157/ADR-0016) — takes pillarId alongside areaId (unlike the old
 * Health-only version, which could hardcode "/health") so the right
 * generic /[pillarId]/[areaId] page gets revalidated. Callers already have
 * both ids on hand (an Area page knows its own pillarId), matching the
 * existing `.bind(null, area.id)` binding pattern with one more bound arg. */
export async function updateAreaCurrentState(pillarId: string, areaId: string, value: string): Promise<SaveResult> {
  return trySave(
    () => prisma.area.update({ where: { id: areaId }, data: { currentState: value || null } }),
    `${pillarHref(pillarId)}/${areaId}`
  );
}

export async function updateAreaNorthStar(pillarId: string, areaId: string, value: string): Promise<SaveResult> {
  return trySave(
    () => prisma.area.update({ where: { id: areaId }, data: { northStar: value || null } }),
    `${pillarHref(pillarId)}/${areaId}`
  );
}

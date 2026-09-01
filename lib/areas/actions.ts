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

export type CreateAreaResult = { ok: true; id: string } | { ok: false; error: string };

/** Mirrors createPillar's minimalism exactly (#159/ADR-0016) — a new Area
 * is just its row + a name, everything else (currentState, northStar)
 * fill-in-later. sortOrder is appended after every existing Area under
 * this Pillar; a race between two concurrent creates could in principle
 * both compute the same count and land on the same sortOrder, but that's
 * a display-order tie, not a correctness bug, and not worth guarding
 * against in this single-user app. */
export async function createArea(pillarId: string, name: string): Promise<CreateAreaResult> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Give the area a name first." };
  try {
    const sortOrder = await prisma.area.count({ where: { pillarId } });
    const area = await prisma.area.create({ data: { id: crypto.randomUUID(), pillarId, name: trimmed, sortOrder } });
    revalidatePath(pillarHref(pillarId));
    return { ok: true, id: area.id };
  } catch {
    return { ok: false, error: "Couldn't save — try again." };
  }
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

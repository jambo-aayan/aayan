"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { pillarHref } from "@/lib/pillars/nav";
import type { LifeGoalStatus } from "./data";

export type ActionResult = { ok: true } | { ok: false; error: string };

const SAVE_ERROR = "Couldn't save — try again.";

/** `/pillars/${pillarId}` was always a no-op — that route never existed,
 * `/pillars` is a flat index — and `/health/${areaId}` stopped existing at
 * all once #157 replaced it with the generic /[pillarId]/[areaId] route.
 * Fixed to the real paths as part of #158, which is the first thing to
 * actually surface Goals on those pages. */
function revalidateGoalPaths(pillarId: string, areaId: string | null) {
  revalidatePath("/goals");
  revalidatePath("/today");
  const base = pillarHref(pillarId);
  revalidatePath(base);
  if (areaId) revalidatePath(`${base}/${areaId}`);
}

export type GoalInput = { name: string; pillarId: string; areaId: string | null };

export type CreateGoalResult = { ok: true; id: string } | { ok: false; error: string };

export async function createGoal(input: GoalInput): Promise<CreateGoalResult> {
  const name = input.name.trim();
  if (!name) return { ok: false, error: "Give the goal a name first." };
  try {
    const goal = await prisma.lifeGoal.create({
      data: { name, pillarId: input.pillarId, areaId: input.areaId },
    });
    revalidateGoalPaths(input.pillarId, input.areaId);
    return { ok: true, id: goal.id };
  } catch {
    return { ok: false, error: SAVE_ERROR };
  }
}

export async function updateGoal(id: string, input: GoalInput): Promise<ActionResult> {
  const name = input.name.trim();
  if (!name) return { ok: false, error: "Give the goal a name first." };
  try {
    await prisma.lifeGoal.update({
      where: { id },
      data: { name, pillarId: input.pillarId, areaId: input.areaId },
    });
  } catch {
    return { ok: false, error: SAVE_ERROR };
  }
  revalidateGoalPaths(input.pillarId, input.areaId);
  return { ok: true };
}

export async function setGoalStatus(id: string, status: LifeGoalStatus): Promise<ActionResult> {
  let goal;
  try {
    goal = await prisma.lifeGoal.update({ where: { id }, data: { status } });
  } catch {
    return { ok: false, error: SAVE_ERROR };
  }
  revalidateGoalPaths(goal.pillarId, goal.areaId);
  return { ok: true };
}

"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export type ActionGoalInput = {
  name: string;
  status: "NOT_STARTED" | "IN_PROGRESS" | "DONE";
  dueDate: Date | null;
  myday: boolean;
};

export type ActionGoalResult =
  | { ok: true; item: ActionGoalInput & { id: string; areaId: string } }
  | { ok: false; error: string };

export type ActionResult = { ok: true } | { ok: false; error: string };

const SAVE_ERROR = "Couldn't save — try again.";

function revalidateActionGoalPaths(areaId: string) {
  revalidatePath(`/health/${areaId}`);
  revalidatePath("/my-day");
  revalidatePath("/all-actions");
}

export async function createActionGoal(areaId: string, input: ActionGoalInput): Promise<ActionGoalResult> {
  let goal;
  try {
    goal = await prisma.actionGoal.create({ data: { ...input, areaId } });
  } catch {
    return { ok: false, error: SAVE_ERROR };
  }
  revalidateActionGoalPaths(areaId);
  return { ok: true, item: { ...input, id: goal.id, areaId } };
}

export async function updateActionGoal(id: string, input: ActionGoalInput): Promise<ActionResult> {
  let goal;
  try {
    goal = await prisma.actionGoal.update({ where: { id }, data: input });
  } catch {
    return { ok: false, error: SAVE_ERROR };
  }
  revalidateActionGoalPaths(goal.areaId);
  return { ok: true };
}

export async function deleteActionGoal(id: string): Promise<ActionResult> {
  let goal;
  try {
    goal = await prisma.actionGoal.delete({ where: { id } });
  } catch {
    return { ok: false, error: "Couldn't delete — try again." };
  }
  revalidateActionGoalPaths(goal.areaId);
  return { ok: true };
}

/** Recreates a just-deleted goal with its original id, for the delete-undo toast. */
export async function restoreActionGoal(
  goal: ActionGoalInput & { id: string; areaId: string }
): Promise<ActionResult> {
  try {
    await prisma.actionGoal.create({ data: goal });
  } catch {
    return { ok: false, error: "Couldn't undo — the goal may already be back." };
  }
  revalidateActionGoalPaths(goal.areaId);
  return { ok: true };
}

export async function setActionGoalStatus(
  id: string,
  status: ActionGoalInput["status"]
): Promise<ActionResult> {
  let goal;
  try {
    goal = await prisma.actionGoal.update({ where: { id }, data: { status } });
  } catch {
    return { ok: false, error: SAVE_ERROR };
  }
  revalidateActionGoalPaths(goal.areaId);
  return { ok: true };
}

"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export type ActionResult = { ok: true } | { ok: false; error: string };

const SAVE_ERROR = "Couldn't save — try again.";

function revalidateNudgePaths() {
  revalidatePath("/nudges");
  revalidatePath("/", "layout"); // the sidebar/mobile-header badge lives outside /nudges
}

/** Read state changes only here or via markNudgeRead — never by opening
 * the page (see ADR-0002). */
export async function markAllNudgesRead(): Promise<ActionResult> {
  try {
    await prisma.nudge.updateMany({ where: { readAt: null }, data: { readAt: new Date() } });
  } catch {
    return { ok: false, error: SAVE_ERROR };
  }
  revalidateNudgePaths();
  return { ok: true };
}

/** A card's primary action (Log now / Reschedule / Check in / ...) marks
 * that one card read — the actual habit/task mutation is each action's
 * own existing server action, called separately by the caller. */
export async function markNudgeRead(id: string): Promise<ActionResult> {
  try {
    await prisma.nudge.update({ where: { id }, data: { readAt: new Date() } });
  } catch {
    return { ok: false, error: SAVE_ERROR };
  }
  revalidateNudgePaths();
  return { ok: true };
}

/** Snoozes until tomorrow morning (08:00 UTC — the same "treat UTC as
 * local wall-clock" convention used throughout, see eligibility.ts). Not
 * a duration picker per the handoff's prototype copy ("Snoozed until
 * tomorrow"). */
export async function snoozeNudge(id: string): Promise<ActionResult> {
  try {
    const now = new Date();
    const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 8, 0, 0));
    await prisma.nudge.update({ where: { id }, data: { snoozedUntil: tomorrow } });
  } catch {
    return { ok: false, error: SAVE_ERROR };
  }
  revalidateNudgePaths();
  return { ok: true };
}

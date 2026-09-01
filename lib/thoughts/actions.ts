"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { pillarHref } from "@/lib/pillars/nav";

export type ThoughtInput = { text: string; date: Date; pillarId: string | null; areaId: string | null };

export type ThoughtResult =
  | { ok: true; item: ThoughtInput & { id: string } }
  | { ok: false; error: string };

export type ActionResult = { ok: true } | { ok: false; error: string };

const SAVE_ERROR = "Couldn't save — try again.";

export async function createThought(input: ThoughtInput): Promise<ThoughtResult> {
  const text = input.text.trim();
  if (!text) {
    return { ok: false, error: "Write something first." };
  }
  // pillarId/areaId are meant as one-or-neither, never both — the UI only
  // ever sends one, but a bad caller sending both shouldn't silently tag a
  // Thought to two things at once.
  const data = { ...input, text, pillarId: input.areaId ? null : input.pillarId };
  let thought;
  try {
    thought = await prisma.thought.create({ data });
  } catch {
    return { ok: false, error: SAVE_ERROR };
  }
  revalidatePath("/pillars");
  revalidatePath("/thoughts");
  // Only the direct-pillar case is revalidated here, not an area-tagged
  // Thought's own Area page — that would need an extra query to resolve
  // the Area's pillarId, not worth it just for Router Cache freshness (see
  // lib/systems/actions.ts's revalidateSystemPaths for the same tradeoff).
  if (data.pillarId) revalidatePath(pillarHref(data.pillarId));
  return { ok: true, item: { ...data, id: thought.id } };
}

export async function deleteThought(id: string): Promise<ActionResult> {
  try {
    await prisma.thought.delete({ where: { id } });
  } catch {
    return { ok: false, error: "Couldn't delete — try again." };
  }
  revalidatePath("/thoughts");
  return { ok: true };
}

/** Recreates a just-deleted Thought with its original id, for the delete-undo toast. */
export async function restoreThought(thought: ThoughtInput & { id: string }): Promise<ActionResult> {
  try {
    await prisma.thought.create({ data: thought });
  } catch {
    return { ok: false, error: "Couldn't undo — the thought may already be back." };
  }
  revalidatePath("/thoughts");
  if (thought.pillarId) revalidatePath(pillarHref(thought.pillarId));
  return { ok: true };
}

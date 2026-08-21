"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ensureInboxList } from "@/lib/tasks/inbox";

export type ActionResult = { ok: true } | { ok: false; error: string };

function utcMidnight(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** One Task per non-empty digest sentence, landing in Inbox due today —
 * the digest's "Turn into tasks" action. */
export async function turnDigestIntoTasks(sentences: string[]): Promise<ActionResult> {
  const trimmed = sentences.map((s) => s.trim()).filter(Boolean);
  if (trimmed.length === 0) return { ok: false, error: "Nothing to turn into tasks." };

  try {
    const inboxId = await ensureInboxList();
    const top = await prisma.task.findFirst({ where: { listId: inboxId }, orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
    const today = utcMidnight(new Date());
    let sortOrder = (top?.sortOrder ?? -1) + 1;
    await prisma.$transaction(
      trimmed.map((title) =>
        prisma.task.create({ data: { title, listId: inboxId, sortOrder: sortOrder++, dueDate: today } })
      )
    );
  } catch {
    return { ok: false, error: "Couldn't save — try again." };
  }
  revalidatePath("/today");
  revalidatePath("/all-tasks");
  return { ok: true };
}

/** One Thought combining every digest sentence — the digest's "Save as
 * thought" action. */
export async function saveDigestAsThought(sentences: string[]): Promise<ActionResult> {
  const text = sentences
    .map((s) => s.trim())
    .filter(Boolean)
    .join(" ");
  if (!text) return { ok: false, error: "Nothing to save." };

  try {
    await prisma.thought.create({ data: { text, date: utcMidnight(new Date()) } });
  } catch {
    return { ok: false, error: "Couldn't save — try again." };
  }
  revalidatePath("/thoughts");
  revalidatePath("/today");
  return { ok: true };
}

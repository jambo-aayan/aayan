"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ensureInboxList } from "@/lib/tasks/inbox";
import { FINANCE_NORTH_STAR_ID } from "@/lib/finance/north-star-id";

export type ActionResult = { ok: true } | { ok: false; error: string };

function utcMidnight(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/**
 * "Load sample data" from the Day-one screen — a plausible starter
 * dataset covering all four setup steps at once, for someone who wants to
 * look around before committing to their own Pillars. Deliberately not
 * routed through each domain's own create action (createHabit forces new
 * habits PAUSED, createPillar doesn't take a color): sample data should
 * show up ACTIVE and colored immediately, since the point is to look
 * lived-in right away.
 */
export async function loadSampleData(): Promise<ActionResult> {
  try {
    const today = utcMidnight(new Date());
    const deadline = new Date(Date.UTC(today.getUTCFullYear() + 1, today.getUTCMonth(), today.getUTCDate()));

    const work = await prisma.pillar.create({
      data: { id: crypto.randomUUID(), name: "Work", desc: "Career and craft", color: "coral" },
    });
    const personal = await prisma.pillar.create({
      data: { id: crypto.randomUUID(), name: "Personal growth", desc: "Learning and reflection", color: "lavender" },
    });

    await prisma.habit.create({
      data: { name: "Drink a glass of water", pillarId: personal.id, status: "ACTIVE", scheduleType: "DAILY", scheduleAnchorDate: today },
    });

    await prisma.financeNorthStar.upsert({
      where: { id: FINANCE_NORTH_STAR_ID },
      create: { id: FINANCE_NORTH_STAR_ID, target: 10000, deadline },
      update: { target: 10000, deadline },
    });

    const inboxId = await ensureInboxList();
    const topSort =
      (await prisma.task.findFirst({ where: { listId: inboxId }, orderBy: { sortOrder: "desc" }, select: { sortOrder: true } }))
        ?.sortOrder ?? -1;
    await prisma.task.create({
      data: { title: "Explore the app", listId: inboxId, pillarId: work.id, sortOrder: topSort + 1, dueDate: today },
    });

    await prisma.thought.create({ data: { text: "Excited to get started.", date: today, pillarId: personal.id } });

    revalidatePath("/", "layout");
    return { ok: true };
  } catch {
    return { ok: false, error: "Couldn't load sample data — try again." };
  }
}

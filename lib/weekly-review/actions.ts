"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { deleteTask, completeTask, rescheduleTask } from "@/lib/tasks/actions";
import { setHabitStatus } from "@/lib/habits/actions";
import { mondayOf } from "@/lib/habits/streak";
import { nextWeekDueDate, topThree } from "./pure";
import { getReviewDigestDraft, getRankCandidates } from "./data";
import { WEEKLY_REVIEW_SESSION_ID, type ReviewVerdict } from "./session";

export type ActionResult = { ok: true } | { ok: false; error: string };
export type DraftResult = { ok: true; draft: string } | { ok: false; error: string };

const SAVE_ERROR = "Couldn't save — try again.";

function utcMidnight(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function revalidateReview() {
  revalidatePath("/weekly-review");
}

export async function setReviewStep(step: number): Promise<ActionResult> {
  try {
    await prisma.weeklyReviewSession.update({ where: { id: WEEKLY_REVIEW_SESSION_ID }, data: { step } });
  } catch {
    return { ok: false, error: SAVE_ERROR };
  }
  revalidateReview();
  return { ok: true };
}

// --- Step 1: Close out ---

export async function dropReviewTask(taskId: string): Promise<ActionResult> {
  const result = await deleteTask(taskId);
  revalidateReview();
  return result;
}

export async function completeReviewTask(taskId: string): Promise<ActionResult> {
  const result = await completeTask(taskId);
  revalidateReview();
  return result;
}

/** "Next week" — +7 days from today, not from the task's old due date
 * (see lib/weekly-review/pure.ts's nextWeekDueDate). */
export async function pushReviewTaskToNextWeek(taskId: string): Promise<ActionResult> {
  const result = await rescheduleTask(taskId, nextWeekDueDate(utcMidnight(new Date())));
  revalidateReview();
  return result;
}

// --- Step 2: Habits ---

/** Keep confirms ACTIVE, Pause actually pauses the habit (both real
 * status changes, not just a recorded opinion) — Rework has no Habit
 * status to change to, so it's recorded in the verdict only, for the
 * digest to reference. */
export async function setHabitVerdict(habitId: string, verdict: ReviewVerdict): Promise<ActionResult> {
  try {
    if (verdict === "KEEP") await setHabitStatus(habitId, "ACTIVE");
    if (verdict === "PAUSE") await setHabitStatus(habitId, "PAUSED");

    const session = await prisma.weeklyReviewSession.findUniqueOrThrow({ where: { id: WEEKLY_REVIEW_SESSION_ID } });
    const verdicts = { ...(session.verdicts as Record<string, ReviewVerdict>), [habitId]: verdict };
    await prisma.weeklyReviewSession.update({ where: { id: WEEKLY_REVIEW_SESSION_ID }, data: { verdicts } });
  } catch {
    return { ok: false, error: SAVE_ERROR };
  }
  revalidateReview();
  return { ok: true };
}

// --- Step 3: Re-rank ---

export async function setReviewRankOrder(orderedIds: string[]): Promise<ActionResult> {
  try {
    await prisma.weeklyReviewSession.update({ where: { id: WEEKLY_REVIEW_SESSION_ID }, data: { rankOrder: orderedIds } });
  } catch {
    return { ok: false, error: SAVE_ERROR };
  }
  revalidateReview();
  return { ok: true };
}

// --- Step 5: Write it ---

export async function regenerateReviewDigest(): Promise<DraftResult> {
  try {
    const draft = await getReviewDigestDraft();
    await prisma.weeklyReviewSession.update({ where: { id: WEEKLY_REVIEW_SESSION_ID }, data: { draftDigest: draft } });
    revalidateReview();
    return { ok: true, draft };
  } catch {
    return { ok: false, error: SAVE_ERROR };
  }
}

export async function saveDraftDigest(text: string): Promise<ActionResult> {
  try {
    await prisma.weeklyReviewSession.update({ where: { id: WEEKLY_REVIEW_SESSION_ID }, data: { draftDigest: text } });
  } catch {
    return { ok: false, error: SAVE_ERROR };
  }
  return { ok: true };
}

/**
 * "Save to Thoughts & finish": saves the (possibly hand-edited) digest as
 * a real Thought, gives the top 3 re-ranked candidates a My Day entry for
 * next Monday (Step 3's "become next week's My Day defaults"), and resets
 * the session to a fresh review — so opening Weekly review again starts
 * clean rather than resuming a finished one.
 */
export async function finishReview(editedDigest: string): Promise<ActionResult> {
  const text = editedDigest.trim();
  if (!text) return { ok: false, error: "Write something before finishing." };

  try {
    const session = await prisma.weeklyReviewSession.findUniqueOrThrow({ where: { id: WEEKLY_REVIEW_SESSION_ID } });
    // Reconcile against live candidates rather than trusting the raw saved
    // order: a user who never touches Step 3's reorder UI leaves rankOrder
    // empty, but Step 3 still visually shows a default-ordered top three —
    // finish must honor what was actually shown, not the untouched column.
    const candidates = await getRankCandidates(session.rankOrder);
    const top3 = topThree(candidates.map((c) => c.id));
    const nextMonday = mondayOf(nextWeekDueDate(utcMidnight(new Date())));

    await prisma.$transaction([
      prisma.thought.create({ data: { text, date: utcMidnight(new Date()) } }),
      ...top3.map((taskId, index) =>
        prisma.myDayEntry.upsert({
          where: { taskId_date: { taskId, date: nextMonday } },
          create: { taskId, date: nextMonday, sortOrder: index },
          update: { sortOrder: index },
        })
      ),
      prisma.weeklyReviewSession.update({
        where: { id: WEEKLY_REVIEW_SESSION_ID },
        data: { step: 0, draftDigest: null, verdicts: {}, rankOrder: [] },
      }),
    ]);
  } catch {
    return { ok: false, error: SAVE_ERROR };
  }
  revalidateReview();
  revalidatePath("/thoughts");
  revalidatePath("/today");
  return { ok: true };
}

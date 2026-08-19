"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { nextOccurrenceDate } from "./recurrence";
import { ensureInboxList, INBOX_LIST_ID } from "./inbox";
import type { TaskReminderOffset, TaskRepeatRule } from "./types";

export type ActionResult = { ok: true } | { ok: false; error: string };

const SAVE_ERROR = "Couldn't save — try again.";

function revalidateTaskPaths() {
  revalidatePath("/today");
  revalidatePath("/tasks");
  revalidatePath("/all-tasks");
  revalidatePath("/by-date");
  revalidatePath("/goals");
}

function dateOnly(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** Finds-or-creates each tag by name (case-sensitive match, same as the
 * Enable Banking / Thoughts tag-lite patterns elsewhere) and returns their ids. */
async function resolveTagIds(tagNames: string[]): Promise<string[]> {
  const names = [...new Set(tagNames.map((n) => n.trim()).filter(Boolean))];
  if (names.length === 0) return [];
  const ids: string[] = [];
  for (const name of names) {
    const tag = await prisma.taskTag.upsert({
      where: { name },
      create: { name },
      update: {},
    });
    ids.push(tag.id);
  }
  return ids;
}

async function nextSortOrderInList(listId: string): Promise<number> {
  const top = await prisma.task.findFirst({ where: { listId }, orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
  return (top?.sortOrder ?? -1) + 1;
}

export type TaskInput = {
  title: string;
  notes: string | null;
  listId: string | null;
  pillarId: string | null;
  areaId: string | null;
  goalId: string | null;
  tagNames: string[];
  dueDate: Date | null;
  dueTime: string | null;
  reminderOffset: TaskReminderOffset | null;
  repeatRule: TaskRepeatRule | null;
  important: boolean;
};

export type CreateTaskResult = { ok: true; id: string } | { ok: false; error: string };

/** addToMyDayToday: whether this task should show up in today's My Day
 * regardless of its due date — set by the My Day Quick Add (typing into
 * today's box is itself the "manually add to My Day" action), left false
 * from the full composer/All Tasks, where a due date of today already covers
 * it. Every task gets a List — Inbox when none is chosen (see inbox.ts) —
 * so capture never has to ask "which list?" up front. */
export async function createTask(input: TaskInput, addToMyDayToday: boolean): Promise<CreateTaskResult> {
  const title = input.title.trim();
  if (!title) return { ok: false, error: "Give the task a title first." };

  try {
    const listId = input.listId ?? (await ensureInboxList());
    const [tagIds, sortOrder] = await Promise.all([resolveTagIds(input.tagNames), nextSortOrderInList(listId)]);
    const task = await prisma.task.create({
      data: {
        title,
        notes: input.notes,
        listId,
        pillarId: input.pillarId,
        areaId: input.areaId,
        goalId: input.goalId,
        sortOrder,
        dueDate: input.dueDate,
        dueTime: input.dueTime,
        reminderOffset: input.reminderOffset,
        repeatRule: input.repeatRule,
        important: input.important,
        tags: { create: tagIds.map((tagId) => ({ tagId })) },
        myDayEntries: addToMyDayToday ? { create: { date: dateOnly(new Date()) } } : undefined,
      },
    });
    revalidateTaskPaths();
    return { ok: true, id: task.id };
  } catch {
    return { ok: false, error: SAVE_ERROR };
  }
}

export async function updateTask(id: string, input: TaskInput): Promise<ActionResult> {
  const title = input.title.trim();
  if (!title) return { ok: false, error: "Give the task a title first." };

  try {
    const listId = input.listId ?? (await ensureInboxList());
    const tagIds = await resolveTagIds(input.tagNames);
    await prisma.$transaction([
      prisma.taskTagOnTask.deleteMany({ where: { taskId: id } }),
      prisma.task.update({
        where: { id },
        data: {
          title,
          notes: input.notes,
          listId,
          pillarId: input.pillarId,
          areaId: input.areaId,
          goalId: input.goalId,
          dueDate: input.dueDate,
          dueTime: input.dueTime,
          reminderOffset: input.reminderOffset,
          repeatRule: input.repeatRule,
          important: input.important,
          tags: { create: tagIds.map((tagId) => ({ tagId })) },
        },
      }),
    ]);
    revalidateTaskPaths();
    return { ok: true };
  } catch {
    return { ok: false, error: SAVE_ERROR };
  }
}

/**
 * Marks a task complete, preserving it in place (never deleted — see
 * Task's schema comment on the three-timestamp lifecycle). If it repeats,
 * clones a fresh ACTIVE occurrence for the next due date rather than
 * mutating this row, so this completion stays in history exactly as it
 * happened. CUSTOM repeat rules don't auto-schedule (see recurrence.ts) —
 * the task simply stops recurring until manually rescheduled.
 */
export async function completeTask(id: string): Promise<ActionResult> {
  try {
    const task = await prisma.task.findUnique({
      where: { id },
      include: { tags: true },
    });
    if (!task) return { ok: false, error: "That task no longer exists." };

    await prisma.task.update({
      where: { id },
      data: { status: "COMPLETED", completedAt: new Date() },
    });

    if (task.repeatRule && task.dueDate) {
      const next = nextOccurrenceDate(task.repeatRule, task.dueDate);
      if (next) {
        const sortOrder = task.listId ? await nextSortOrderInList(task.listId) : 0;
        await prisma.task.create({
          data: {
            title: task.title,
            notes: task.notes,
            listId: task.listId,
            pillarId: task.pillarId,
            areaId: task.areaId,
            goalId: task.goalId,
            sortOrder,
            dueDate: next,
            dueTime: task.dueTime,
            reminderOffset: task.reminderOffset,
            repeatRule: task.repeatRule,
            important: task.important,
            tags: { create: task.tags.map((t) => ({ tagId: t.tagId })) },
          },
        });
      }
    }
  } catch {
    return { ok: false, error: SAVE_ERROR };
  }
  revalidateTaskPaths();
  return { ok: true };
}

export async function uncompleteTask(id: string): Promise<ActionResult> {
  try {
    await prisma.task.update({ where: { id }, data: { status: "ACTIVE", completedAt: null } });
  } catch {
    return { ok: false, error: SAVE_ERROR };
  }
  revalidateTaskPaths();
  return { ok: true };
}

export async function setTaskImportant(id: string, important: boolean): Promise<ActionResult> {
  try {
    await prisma.task.update({ where: { id }, data: { important } });
  } catch {
    return { ok: false, error: SAVE_ERROR };
  }
  revalidateTaskPaths();
  return { ok: true };
}

export async function addTaskToMyDay(taskId: string, date: Date = new Date()): Promise<ActionResult> {
  try {
    await prisma.myDayEntry.upsert({
      where: { taskId_date: { taskId, date: dateOnly(date) } },
      create: { taskId, date: dateOnly(date) },
      update: {},
    });
  } catch {
    return { ok: false, error: SAVE_ERROR };
  }
  revalidateTaskPaths();
  return { ok: true };
}

export async function removeTaskFromMyDay(taskId: string, date: Date = new Date()): Promise<ActionResult> {
  try {
    await prisma.myDayEntry.deleteMany({ where: { taskId, date: dateOnly(date) } });
  } catch {
    return { ok: false, error: SAVE_ERROR };
  }
  revalidateTaskPaths();
  return { ok: true };
}

/** Adds every still-unfinished task from yesterday's My Day into today's —
 * the banner's bulk action, not an automatic carry-over (see MyDayEntry's
 * schema comment: due dates are never silently altered). */
export async function addYesterdayTasksToToday(taskIds: string[]): Promise<ActionResult> {
  const today = dateOnly(new Date());
  try {
    await prisma.$transaction(
      taskIds.map((taskId) =>
        prisma.myDayEntry.upsert({
          where: { taskId_date: { taskId, date: today } },
          create: { taskId, date: today },
          update: {},
        })
      )
    );
  } catch {
    return { ok: false, error: SAVE_ERROR };
  }
  revalidateTaskPaths();
  return { ok: true };
}

/** Persists a new manual order within one day's My Day — independent of the
 * task's List sortOrder (see Task's schema comment). Upserts a MyDayEntry
 * for any due-today task being reordered that doesn't have one yet, so its
 * position sticks. */
export async function reorderMyDayTasks(orderedTaskIds: string[], date: Date = new Date()): Promise<ActionResult> {
  const day = dateOnly(date);
  try {
    await prisma.$transaction(
      orderedTaskIds.map((taskId, index) =>
        prisma.myDayEntry.upsert({
          where: { taskId_date: { taskId, date: day } },
          create: { taskId, date: day, sortOrder: index },
          update: { sortOrder: index },
        })
      )
    );
  } catch {
    return { ok: false, error: SAVE_ERROR };
  }
  revalidateTaskPaths();
  return { ok: true };
}

/** Persists a new manual order within one List — independent of My Day's
 * ordering (see Task's schema comment). */
export async function reorderListTasks(orderedTaskIds: string[]): Promise<ActionResult> {
  try {
    await prisma.$transaction(
      orderedTaskIds.map((taskId, index) =>
        prisma.task.update({ where: { id: taskId }, data: { sortOrder: index } })
      )
    );
  } catch {
    return { ok: false, error: SAVE_ERROR };
  }
  revalidateTaskPaths();
  return { ok: true };
}

export async function archiveTask(id: string): Promise<ActionResult> {
  try {
    await prisma.task.update({ where: { id }, data: { archivedAt: new Date() } });
  } catch {
    return { ok: false, error: SAVE_ERROR };
  }
  revalidateTaskPaths();
  return { ok: true };
}

export async function unarchiveTask(id: string): Promise<ActionResult> {
  try {
    await prisma.task.update({ where: { id }, data: { archivedAt: null } });
  } catch {
    return { ok: false, error: SAVE_ERROR };
  }
  revalidateTaskPaths();
  return { ok: true };
}

/** Soft delete — the row stays, `deletedAt` is set, and every view (My Day,
 * All Tasks, By Date) filters it out. See restoreTask for undoing this. */
export async function deleteTask(id: string): Promise<ActionResult> {
  try {
    await prisma.task.update({ where: { id }, data: { deletedAt: new Date() } });
  } catch {
    return { ok: false, error: "Couldn't delete — try again." };
  }
  revalidateTaskPaths();
  return { ok: true };
}

export async function restoreTask(id: string): Promise<ActionResult> {
  try {
    await prisma.task.update({ where: { id }, data: { deletedAt: null } });
  } catch {
    return { ok: false, error: "Couldn't undo — try again." };
  }
  revalidateTaskPaths();
  return { ok: true };
}

// --- Steps ---

export type CreateStepResult = { ok: true; id: string } | { ok: false; error: string };

export async function createTaskStep(taskId: string, title: string): Promise<CreateStepResult> {
  const trimmed = title.trim();
  if (!trimmed) return { ok: false, error: "Give the step a title first." };
  try {
    const top = await prisma.taskStep.findFirst({ where: { taskId }, orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
    const step = await prisma.taskStep.create({
      data: { taskId, title: trimmed, sortOrder: (top?.sortOrder ?? -1) + 1 },
    });
    revalidateTaskPaths();
    return { ok: true, id: step.id };
  } catch {
    return { ok: false, error: SAVE_ERROR };
  }
}

export async function toggleTaskStep(stepId: string, completed: boolean): Promise<ActionResult> {
  try {
    await prisma.taskStep.update({ where: { id: stepId }, data: { completed } });
  } catch {
    return { ok: false, error: SAVE_ERROR };
  }
  revalidateTaskPaths();
  return { ok: true };
}

export async function deleteTaskStep(stepId: string): Promise<ActionResult> {
  try {
    await prisma.taskStep.delete({ where: { id: stepId } });
  } catch {
    return { ok: false, error: "Couldn't delete — try again." };
  }
  revalidateTaskPaths();
  return { ok: true };
}

export async function reorderTaskSteps(orderedStepIds: string[]): Promise<ActionResult> {
  try {
    await prisma.$transaction(
      orderedStepIds.map((stepId, index) => prisma.taskStep.update({ where: { id: stepId }, data: { sortOrder: index } }))
    );
  } catch {
    return { ok: false, error: SAVE_ERROR };
  }
  revalidateTaskPaths();
  return { ok: true };
}

// --- Lists ---

export type CreateListResult = { ok: true; id: string } | { ok: false; error: string };

export async function createTaskList(name: string, color: string | null): Promise<CreateListResult> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Give the list a name first." };
  try {
    const list = await prisma.taskList.create({ data: { name: trimmed, color } });
    revalidateTaskPaths();
    return { ok: true, id: list.id };
  } catch {
    return { ok: false, error: SAVE_ERROR };
  }
}

export async function renameTaskList(id: string, name: string, color: string | null): Promise<ActionResult> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Give the list a name first." };
  try {
    await prisma.taskList.update({ where: { id }, data: { name: trimmed, color } });
  } catch {
    return { ok: false, error: SAVE_ERROR };
  }
  revalidateTaskPaths();
  return { ok: true };
}

export async function archiveTaskList(id: string): Promise<ActionResult> {
  if (id === INBOX_LIST_ID) return { ok: false, error: "Inbox can't be archived." };
  try {
    await prisma.taskList.update({ where: { id }, data: { archivedAt: new Date() } });
  } catch {
    return { ok: false, error: SAVE_ERROR };
  }
  revalidateTaskPaths();
  return { ok: true };
}

/** Deletes the list itself, not its tasks — Task.listId is ON DELETE SET
 * NULL (see schema), so every task that was in this list would lose its
 * list label. In practice that never surfaces: updateTask/createTask both
 * resolve a null listId back to Inbox, so a deleted list's former tasks
 * land there instead of showing as unlabeled. */
export async function deleteTaskList(id: string): Promise<ActionResult> {
  if (id === INBOX_LIST_ID) return { ok: false, error: "Inbox can't be deleted." };
  try {
    await prisma.$transaction(async (tx) => {
      const inboxId = await ensureInboxList();
      await tx.task.updateMany({ where: { listId: id }, data: { listId: inboxId } });
      await tx.taskList.delete({ where: { id } });
    });
  } catch {
    return { ok: false, error: "Couldn't delete — try again." };
  }
  revalidateTaskPaths();
  return { ok: true };
}

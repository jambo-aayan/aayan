"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { nextOccurrenceDate } from "./recurrence";
import type { TaskReminderOffset, TaskRepeatRule } from "./types";

export type ActionResult = { ok: true } | { ok: false; error: string };

const SAVE_ERROR = "Couldn't save — try again.";

function revalidateTaskPaths() {
  revalidatePath("/today");
  revalidatePath("/all-tasks");
  revalidatePath("/by-date");
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

export type TaskInput = {
  title: string;
  notes: string | null;
  listId: string | null;
  pillarId: string | null;
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
 * from the full composer/All Tasks, where a due date of today already covers it. */
export async function createTask(input: TaskInput, addToMyDayToday: boolean): Promise<CreateTaskResult> {
  const title = input.title.trim();
  if (!title) return { ok: false, error: "Give the task a title first." };

  try {
    const tagIds = await resolveTagIds(input.tagNames);
    const task = await prisma.task.create({
      data: {
        title,
        notes: input.notes,
        listId: input.listId,
        pillarId: input.pillarId,
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
    const tagIds = await resolveTagIds(input.tagNames);
    await prisma.$transaction([
      prisma.taskTagOnTask.deleteMany({ where: { taskId: id } }),
      prisma.task.update({
        where: { id },
        data: {
          title,
          notes: input.notes,
          listId: input.listId,
          pillarId: input.pillarId,
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
        await prisma.task.create({
          data: {
            title: task.title,
            notes: task.notes,
            listId: task.listId,
            pillarId: task.pillarId,
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

// --- Lists ---

export type CreateListResult = { ok: true; id: string } | { ok: false; error: string };

export async function createTaskList(name: string): Promise<CreateListResult> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Give the list a name first." };
  try {
    const list = await prisma.taskList.create({ data: { name: trimmed } });
    revalidateTaskPaths();
    return { ok: true, id: list.id };
  } catch {
    return { ok: false, error: SAVE_ERROR };
  }
}

export async function renameTaskList(id: string, name: string): Promise<ActionResult> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Give the list a name first." };
  try {
    await prisma.taskList.update({ where: { id }, data: { name: trimmed } });
  } catch {
    return { ok: false, error: SAVE_ERROR };
  }
  revalidateTaskPaths();
  return { ok: true };
}

export async function archiveTaskList(id: string): Promise<ActionResult> {
  try {
    await prisma.taskList.update({ where: { id }, data: { archivedAt: new Date() } });
  } catch {
    return { ok: false, error: SAVE_ERROR };
  }
  revalidateTaskPaths();
  return { ok: true };
}

/** Deletes the list itself, not its tasks — Task.listId is ON DELETE SET
 * NULL (see schema), so every task that was in this list just loses its
 * list label and stays exactly where it was otherwise. */
export async function deleteTaskList(id: string): Promise<ActionResult> {
  try {
    await prisma.taskList.delete({ where: { id } });
  } catch {
    return { ok: false, error: "Couldn't delete — try again." };
  }
  revalidateTaskPaths();
  return { ok: true };
}

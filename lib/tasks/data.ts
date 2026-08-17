import "server-only";
import { prisma } from "@/lib/prisma";
import type { Task } from "./types";

// Fetches capped at 500 rows — the active/non-archived/non-deleted backlog
// naturally self-limits over time (completed and archived tasks are
// excluded by definition), so this is a safety valve against a pathological
// case, not an expected everyday limit. All Tasks' Completed/Archived
// filters are the place for full historical browsing and would need real
// pagination before this cap could bite there.
const SAFETY_LIMIT = 500;

const TASK_INCLUDE = {
  list: { select: { id: true, name: true } },
  pillar: { select: { id: true, name: true } },
  tags: { include: { tag: { select: { id: true, name: true } } } },
} as const;

type TaskRow = {
  id: string;
  title: string;
  notes: string | null;
  status: Task["status"];
  important: boolean;
  listId: string | null;
  list: { id: string; name: string } | null;
  pillarId: string | null;
  pillar: { id: string; name: string } | null;
  dueDate: Date | null;
  dueTime: string | null;
  reminderOffset: Task["reminderOffset"];
  repeatRule: Task["repeatRule"];
  completedAt: Date | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  tags: { tag: { id: string; name: string } }[];
};

function mapTask(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    notes: row.notes,
    status: row.status,
    important: row.important,
    listId: row.listId,
    listName: row.list?.name ?? null,
    pillarId: row.pillarId,
    pillarName: row.pillar?.name ?? null,
    dueDate: row.dueDate,
    dueTime: row.dueTime,
    reminderOffset: row.reminderOffset,
    repeatRule: row.repeatRule,
    completedAt: row.completedAt,
    archivedAt: row.archivedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    tags: row.tags.map((t) => t.tag),
  };
}

function dateOnly(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** Tasks that belong in My Day for `date` — manually added (a MyDayEntry row
 * for that date) or automatically due that day. See MyDayEntry's schema
 * comment: never a boolean, so this is a query, not a stored flag. */
export async function getMyDayTasks(date: Date): Promise<Task[]> {
  const day = dateOnly(date);
  const rows = await prisma.task.findMany({
    where: {
      deletedAt: null,
      archivedAt: null,
      status: "ACTIVE",
      OR: [{ dueDate: day }, { myDayEntries: { some: { date: day } } }],
    },
    include: TASK_INCLUDE,
    orderBy: [{ important: "desc" }, { createdAt: "asc" }],
  });
  return rows.map(mapTask);
}

/** Tasks manually added to My Day yesterday that are still unfinished and
 * aren't already going to appear in today's My Day on their own (due today,
 * or already re-added) — the "N unfinished tasks from yesterday" banner. */
export async function getYesterdayUnfinishedTasks(today: Date): Promise<Task[]> {
  const day = dateOnly(today);
  const yesterday = new Date(day);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);

  const rows = await prisma.task.findMany({
    where: {
      status: "ACTIVE",
      deletedAt: null,
      archivedAt: null,
      myDayEntries: { some: { date: yesterday } },
      NOT: { OR: [{ dueDate: day }, { myDayEntries: { some: { date: day } } }] },
    },
    include: TASK_INCLUDE,
    orderBy: { createdAt: "asc" },
  });
  return rows.map(mapTask);
}

/** Tasks completed on `date` — kept out of getMyDayTasks (ACTIVE only) so
 * My Day's default view stays uncluttered; surfaced only behind a "Show
 * completed" toggle. */
export async function getTodayCompletedTasks(date: Date): Promise<Task[]> {
  const day = dateOnly(date);
  const nextDay = new Date(day);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);

  const rows = await prisma.task.findMany({
    where: {
      status: "COMPLETED",
      deletedAt: null,
      completedAt: { gte: day, lt: nextDay },
    },
    include: TASK_INCLUDE,
    orderBy: { completedAt: "desc" },
  });
  return rows.map(mapTask);
}

export type TaskView =
  | "active"
  | "completed"
  | "archived"
  | "today"
  | "upcoming"
  | "overdue"
  | "noDueDate"
  | "important";

export type TaskFilter = {
  view?: TaskView;
  listId?: string;
  pillarId?: string;
  tagId?: string;
  search?: string;
};

/** The where-clause backbone for every view except completed/archived, which
 * explicitly want to see past the "not deleted, not archived, active" default. */
function baseActiveWhere() {
  return { deletedAt: null, archivedAt: null, status: "ACTIVE" as const };
}

export async function getAllTasks(filter: TaskFilter): Promise<Task[]> {
  const today = dateOnly(new Date());
  const where: Record<string, unknown> = { deletedAt: null };

  switch (filter.view) {
    case "completed":
      where.status = "COMPLETED";
      where.archivedAt = null;
      break;
    case "archived":
      where.NOT = { archivedAt: null };
      break;
    case "today":
      Object.assign(where, baseActiveWhere(), { dueDate: today });
      break;
    case "upcoming":
      Object.assign(where, baseActiveWhere(), { dueDate: { gt: today } });
      break;
    case "overdue":
      Object.assign(where, baseActiveWhere(), { dueDate: { lt: today } });
      break;
    case "noDueDate":
      Object.assign(where, baseActiveWhere(), { dueDate: null });
      break;
    case "important":
      Object.assign(where, baseActiveWhere(), { important: true });
      break;
    case "active":
    default:
      Object.assign(where, baseActiveWhere());
      break;
  }

  if (filter.listId) where.listId = filter.listId;
  if (filter.pillarId) where.pillarId = filter.pillarId;
  if (filter.tagId) where.tags = { some: { tagId: filter.tagId } };
  if (filter.search?.trim()) {
    const q = filter.search.trim();
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { notes: { contains: q, mode: "insensitive" } },
    ];
  }

  const rows = await prisma.task.findMany({
    where,
    include: TASK_INCLUDE,
    orderBy: [{ important: "desc" }, { createdAt: "desc" }],
    take: SAFETY_LIMIT,
  });
  return rows.map(mapTask);
}

/** Every active task with or without a due date, for the By Date view's
 * Overdue/Today/Tomorrow/This week/Later/No due date grouping. */
export async function getActiveTasksForByDate(): Promise<Task[]> {
  const rows = await prisma.task.findMany({
    where: baseActiveWhere(),
    include: TASK_INCLUDE,
    orderBy: [{ important: "desc" }, { createdAt: "asc" }],
    take: SAFETY_LIMIT,
  });
  return rows.map(mapTask);
}

export async function getTaskById(id: string): Promise<Task | null> {
  const row = await prisma.task.findUnique({ where: { id }, include: TASK_INCLUDE });
  return row ? mapTask(row) : null;
}

export async function getPillarOptions(): Promise<{ id: string; name: string }[]> {
  return prisma.pillar.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });
}

export type TaskListSummary = { id: string; name: string; taskCount: number };

export async function getTaskLists(): Promise<TaskListSummary[]> {
  const lists = await prisma.taskList.findMany({
    where: { archivedAt: null },
    include: { _count: { select: { tasks: { where: baseActiveWhere() } } } },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  return lists.map((l) => ({ id: l.id, name: l.name, taskCount: l._count.tasks }));
}

export type TaskTagSummary = { id: string; name: string; taskCount: number };

export async function getTaskTags(): Promise<TaskTagSummary[]> {
  const tags = await prisma.taskTag.findMany({
    include: { _count: { select: { tasks: { where: { task: baseActiveWhere() } } } } },
    orderBy: { name: "asc" },
  });
  return tags.map((t) => ({ id: t.id, name: t.name, taskCount: t._count.tasks }));
}

/** Lightweight title/notes search over active tasks — not a search subsystem,
 * just a capped `contains` query. */
export async function searchTasks(query: string): Promise<Task[]> {
  const q = query.trim();
  if (!q) return [];
  const rows = await prisma.task.findMany({
    where: {
      ...baseActiveWhere(),
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { notes: { contains: q, mode: "insensitive" } },
      ],
    },
    include: TASK_INCLUDE,
    orderBy: { updatedAt: "desc" },
    take: 30,
  });
  return rows.map(mapTask);
}

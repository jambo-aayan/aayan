import { streakForHabit } from "../habits/streak";
import type { TableAdapterKind } from "./config";

/** Pure transforms for the four bound-table sources (#169, ADR-0017) —
 * each declares its own fixed built-in column set and a resolver turning
 * one already-fetched domain row into that column set's values, keyed by
 * a stable string id (never a cuid, so it can never collide with a real
 * TableColumn's id — lib/visuals/resolve-table-binding.ts relies on that
 * to tell a built-in column apart from a custom one by id shape alone,
 * same "id shape as the marker" idiom lib/visuals/actions.ts's
 * restoreVisual uses for a bound chart's synthetic records). Pure — no
 * Prisma/React — the impure fetch lives in resolve-table-binding.ts. */

export type TableColumnKind = "TEXT" | "NUMBER" | "DATE" | "CHECKBOX";
export type BuiltInColumnDef = { id: string; name: string; type: TableColumnKind };

export const BUILT_IN_COLUMNS: Record<TableAdapterKind, BuiltInColumnDef[]> = {
  goals: [
    { id: "goals:name", name: "Name", type: "TEXT" },
    { id: "goals:status", name: "Status", type: "TEXT" },
    { id: "goals:progress", name: "Progress %", type: "NUMBER" },
  ],
  habits: [
    { id: "habits:name", name: "Name", type: "TEXT" },
    { id: "habits:status", name: "Status", type: "TEXT" },
    { id: "habits:streak", name: "Current streak", type: "NUMBER" },
  ],
  tasks: [
    { id: "tasks:title", name: "Title", type: "TEXT" },
    { id: "tasks:list", name: "List", type: "TEXT" },
    { id: "tasks:dueDate", name: "Due date", type: "DATE" },
    { id: "tasks:completed", name: "Completed", type: "CHECKBOX" },
  ],
  systems: [
    { id: "systems:name", name: "Name", type: "TEXT" },
    { id: "systems:type", name: "Type", type: "TEXT" },
    { id: "systems:state", name: "State", type: "TEXT" },
  ],
  "category-spend": [
    { id: "category-spend:category", name: "Category", type: "TEXT" },
    { id: "category-spend:parent", name: "Parent", type: "TEXT" },
    { id: "category-spend:thisMonth", name: "This month", type: "NUMBER" },
    { id: "category-spend:lastMonth", name: "Last month", type: "NUMBER" },
  ],
};

export type GoalRow = { name: string; status: string; tasks: { completedAt: Date | null }[] };

/** "Progress %" — the share of a Goal's own linked Tasks that are done;
 * 0 with no linked tasks rather than an undefined/NaN percentage. */
export function goalBuiltInValues(goal: GoalRow): Record<string, unknown> {
  const total = goal.tasks.length;
  const completed = goal.tasks.filter((t) => t.completedAt !== null).length;
  return {
    "goals:name": goal.name,
    "goals:status": goal.status,
    "goals:progress": total === 0 ? 0 : Math.round((completed / total) * 100),
  };
}

export type HabitRow = {
  name: string;
  status: string;
  scheduleType: Parameters<typeof streakForHabit>[0]["scheduleType"];
  scheduleTargetCount: number | null;
  checkInDates: Date[];
};

/** "Current streak" reuses lib/habits/streak.ts's own streakForHabit — the
 * same figure a Habit's own card shows, not a second copy of that logic. */
export function habitBuiltInValues(habit: HabitRow): Record<string, unknown> {
  return {
    "habits:name": habit.name,
    "habits:status": habit.status,
    "habits:streak": streakForHabit(habit),
  };
}

export type TaskRow = {
  title: string;
  listName: string | null;
  dueDate: Date | null;
  completedAt: Date | null;
};

export function taskBuiltInValues(task: TaskRow): Record<string, unknown> {
  return {
    "tasks:title": task.title,
    "tasks:list": task.listName,
    "tasks:dueDate": task.dueDate ? task.dueDate.toISOString().slice(0, 10) : null,
    "tasks:completed": task.completedAt !== null,
  };
}

export type SystemRow = { name: string; type: string; state: string };

export function systemBuiltInValues(system: SystemRow): Record<string, unknown> {
  return {
    "systems:name": system.name,
    "systems:type": system.type,
    "systems:state": system.state,
  };
}

export type CategorySpendRow = { category: string; categoryParent: string; thisMonth: number; lastMonth: number };

/** One row per (leaf) Category (#178) — "This month"/"Last month" are
 * whole-month totals, not the running-total-over-time a bound chart's
 * category-spend adapter plots; a table row is a snapshot, not a series. */
export function categorySpendBuiltInValues(row: CategorySpendRow): Record<string, unknown> {
  return {
    "category-spend:category": row.category,
    "category-spend:parent": row.categoryParent,
    "category-spend:thisMonth": row.thisMonth,
    "category-spend:lastMonth": row.lastMonth,
  };
}

/** True for any column id a bound-table adapter declared (lib/visuals/
 * resolve-table-binding.ts merges these into a bound table's `columns`
 * array alongside real TableColumns) — read-only and unremovable in the
 * UI, unlike a real cuid-keyed custom column. */
export function isBuiltInColumnId(columnId: string): boolean {
  return columnId.includes(":");
}

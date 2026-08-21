"use client";

import { useState } from "react";
import { ListChecks } from "lucide-react";
import { TaskList } from "./task-list";
import type { TaskMenuItem } from "./task-menu";
import { TaskComposer, type TaskFormInput } from "./task-composer";
import { useToast } from "@/components/toast/toast-provider";
import { withRetry } from "@/lib/with-retry";
import { updateTask, completeTask, uncompleteTask, setTaskImportant, deleteTask, restoreTask } from "@/lib/tasks/actions";
import { groupTasksByDate, type TaskDateGroups } from "@/lib/tasks/date-groups";
import type { Task } from "@/lib/tasks/types";
import type { TaskListSummary } from "@/lib/tasks/data";
import styles from "./by-date-tasks.module.css";

type GroupKey = keyof TaskDateGroups<Task>;

const GROUP_LABEL: Record<GroupKey, string> = {
  overdue: "Overdue",
  today: "Today",
  tomorrow: "Tomorrow",
  thisWeek: "This week",
  later: "Later",
  noDueDate: "No due date",
};

const GROUP_ORDER: GroupKey[] = ["overdue", "today", "tomorrow", "thisWeek", "later", "noDueDate"];

export function ByDateTasks({
  initialTasks,
  lists,
  pillars,
  areas,
  goals,
  tagSuggestions,
}: {
  initialTasks: Task[];
  lists: TaskListSummary[];
  pillars: { id: string; name: string; color?: string | null }[];
  areas: { id: string; name: string; pillarId: string }[];
  goals: { id: string; name: string; areaId: string | null; pillarId?: string }[];
  tagSuggestions: string[];
}) {
  const [tasks, setTasks] = useState(initialTasks);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [composer, setComposer] = useState<{ mode: "create" | "edit"; task?: Task } | null>(null);
  const { notifyError, notifyUndo } = useToast();
  const today = new Date();

  async function handleToggleComplete(task: Task) {
    if (pendingIds.has(task.id)) return;
    setPendingIds((prev) => new Set(prev).add(task.id));
    const wasActive = task.status === "ACTIVE";
    setTasks((prev) => prev.filter((t) => t.id !== task.id || !wasActive));
    const result = await withRetry(() => (wasActive ? completeTask(task.id) : uncompleteTask(task.id)));
    setPendingIds((prev) => {
      const next = new Set(prev);
      next.delete(task.id);
      return next;
    });
    if (!result.ok) {
      setTasks((prev) => [...prev, task]);
      notifyError(result.error, { onRetry: () => handleToggleComplete(task) });
    }
  }

  async function handleToggleImportant(task: Task) {
    const next = !task.important;
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, important: next } : t)));
    const result = await withRetry(() => setTaskImportant(task.id, next));
    if (!result.ok) {
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, important: !next } : t)));
      notifyError(result.error, { onRetry: () => handleToggleImportant(task) });
    }
  }

  async function handleDelete(task: Task) {
    setTasks((prev) => prev.filter((t) => t.id !== task.id));
    const result = await withRetry(() => deleteTask(task.id));
    if (!result.ok) {
      setTasks((prev) => [...prev, task]);
      notifyError(result.error, { onRetry: () => handleDelete(task) });
      return;
    }
    notifyUndo(`Deleted "${task.title}".`, () => handleUndoDelete(task));
  }

  async function handleUndoDelete(task: Task) {
    const result = await withRetry(() => restoreTask(task.id));
    if (!result.ok) {
      notifyError(result.error, { onRetry: () => handleUndoDelete(task) });
      return;
    }
    setTasks((prev) => [...prev, task]);
  }

  async function handleComposerSubmit(input: TaskFormInput) {
    if (composer?.mode !== "edit" || !composer.task) return { ok: false as const, error: "Nothing to save." };
    const result = await updateTask(composer.task.id, input);
    if (result.ok) {
      const merged: Task = {
        ...composer.task,
        ...input,
        listName: lists.find((l) => l.id === input.listId)?.name ?? null,
        pillarName: pillars.find((p) => p.id === input.pillarId)?.name ?? null,
        areaName: areas.find((a) => a.id === input.areaId)?.name ?? null,
        tags: input.tagNames.map((name) => ({ id: name, name })),
      };
      setTasks((prev) => prev.map((t) => (t.id === merged.id ? merged : t)));
    }
    return result;
  }

  function menuItemsFor(task: Task): TaskMenuItem[] {
    return [
      { label: "Edit", onSelect: () => setComposer({ mode: "edit", task }) },
      { label: "Delete", onSelect: () => handleDelete(task), danger: true },
    ];
  }

  const groups = groupTasksByDate(tasks, today);

  if (tasks.length === 0) {
    return <TaskList tasks={[]} today={today} pendingIds={pendingIds} onToggleComplete={() => {}} onToggleImportant={() => {}} onOpen={() => {}} menuItemsFor={() => []} emptyIcon={ListChecks} emptyMessage="Nothing here yet — a good sign, or a nudge." />;
  }

  return (
    <div>
      {GROUP_ORDER.map((key) => {
        const group = groups[key];
        if (group.length === 0) return null;
        return (
          <div key={key} className={styles.group}>
            <div className={styles.groupLabel}>{GROUP_LABEL[key]}</div>
            <TaskList
              tasks={group}
              today={today}
              pendingIds={pendingIds}
              onToggleComplete={handleToggleComplete}
              onToggleImportant={handleToggleImportant}
              onOpen={(task) => setComposer({ mode: "edit", task })}
              menuItemsFor={menuItemsFor}
              emptyIcon={ListChecks}
              emptyMessage=""
            />
          </div>
        );
      })}

      {composer && (
        <TaskComposer
          mode={composer.mode}
          task={composer.task}
          lists={lists}
          pillars={pillars}
          areas={areas}
          goals={goals}
          tagSuggestions={tagSuggestions}
          onClose={() => setComposer(null)}
          onSubmit={handleComposerSubmit}
          onToggleComplete={composer.task ? () => handleToggleComplete(composer.task!) : undefined}
          pending={composer.task ? pendingIds.has(composer.task.id) : false}
        />
      )}
    </div>
  );
}

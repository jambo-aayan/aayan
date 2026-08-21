"use client";

import { useState } from "react";
import { ListChecks, Plus } from "lucide-react";
import { TaskList } from "./task-list";
import type { TaskMenuItem } from "./task-menu";
import { TaskComposer, type TaskFormInput } from "./task-composer";
import { PrimaryButton } from "@/components/primary-button";
import { useToast } from "@/components/toast/toast-provider";
import { useDragReorder } from "@/components/use-drag-reorder";
import { withRetry } from "@/lib/with-retry";
import {
  createTask,
  updateTask,
  completeTask,
  uncompleteTask,
  setTaskImportant,
  archiveTask,
  unarchiveTask,
  deleteTask,
  restoreTask,
  addTaskToMyDay,
  reorderListTasks,
} from "@/lib/tasks/actions";
import type { Task } from "@/lib/tasks/types";
import type { TaskListSummary } from "@/lib/tasks/data";
import styles from "./all-tasks-view.module.css";

export function AllTasksView({
  tasks: initialTasks,
  lists,
  pillars,
  areas,
  goals = [],
  tagSuggestions,
  emptyMessage,
  activeListId,
}: {
  tasks: Task[];
  lists: TaskListSummary[];
  pillars: { id: string; name: string; color?: string | null }[];
  areas: { id: string; name: string; pillarId: string }[];
  goals?: { id: string; name: string; areaId: string | null; pillarId?: string }[];
  tagSuggestions: string[];
  emptyMessage: string;
  activeListId?: string;
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
    const apply = (list: Task[]) =>
      list.map((t) =>
        t.id === task.id
          ? { ...t, status: wasActive ? ("COMPLETED" as const) : ("ACTIVE" as const), completedAt: wasActive ? today : null }
          : t
      );
    setTasks(apply);

    const result = await withRetry(() => (wasActive ? completeTask(task.id) : uncompleteTask(task.id)));
    setPendingIds((prev) => {
      const next = new Set(prev);
      next.delete(task.id);
      return next;
    });
    if (!result.ok) {
      setTasks((prev) => prev.map((t) => (t.id === task.id ? task : t)));
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

  async function handleAddToMyDay(task: Task) {
    const result = await withRetry(() => addTaskToMyDay(task.id));
    if (!result.ok) notifyError(result.error, { onRetry: () => handleAddToMyDay(task) });
  }

  async function handleArchiveToggle(task: Task) {
    const archiving = !task.archivedAt;
    setTasks((prev) => prev.filter((t) => t.id !== task.id));
    const result = await withRetry(() => (archiving ? archiveTask(task.id) : unarchiveTask(task.id)));
    if (!result.ok) {
      setTasks((prev) => [...prev, task]);
      notifyError(result.error, { onRetry: () => handleArchiveToggle(task) });
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

  /** Manual List order — independent of My Day's ordering (see Task's schema
   * comment). Only meaningful while filtered to a single List, since
   * sortOrder is scoped per-List. Backed by the same commit path whether the
   * user drags a row or uses the Move up/down menu items. */
  async function commitReorder(reordered: Task[]) {
    const previous = tasks;
    setTasks(reordered);
    const result = await withRetry(() => reorderListTasks(reordered.map((t) => t.id)));
    if (!result.ok) {
      setTasks(previous);
      notifyError(result.error, { onRetry: () => commitReorder(reordered) });
    }
  }

  function handleMove(task: Task, direction: -1 | 1) {
    const index = tasks.findIndex((t) => t.id === task.id);
    const swapWith = index + direction;
    if (index < 0 || swapWith < 0 || swapWith >= tasks.length) return;
    const reordered = [...tasks];
    [reordered[index], reordered[swapWith]] = [reordered[swapWith], reordered[index]];
    commitReorder(reordered);
  }

  const dragReorder = useDragReorder({
    items: tasks,
    getId: (t) => t.id,
    onLiveReorder: setTasks,
    onCommit: commitReorder,
  });

  async function handleComposerSubmit(input: TaskFormInput) {
    if (composer?.mode === "edit" && composer.task) {
      const result = await updateTask(composer.task.id, input);
      if (result.ok) {
        const merged: Task = {
          ...composer.task,
          ...input,
          listName: lists.find((l) => l.id === input.listId)?.name ?? null,
          pillarName: pillars.find((p) => p.id === input.pillarId)?.name ?? null,
          areaName: areas.find((a) => a.id === input.areaId)?.name ?? null,
          goalName: goals.find((g) => g.id === input.goalId)?.name ?? null,
          tags: input.tagNames.map((name) => ({ id: name, name })),
        };
        setTasks((prev) => prev.map((t) => (t.id === merged.id ? merged : t)));
      }
      return result;
    }

    const result = await createTask(input, false);
    if (result.ok) {
      const created: Task = {
        id: result.id,
        title: input.title,
        notes: input.notes,
        status: "ACTIVE",
        important: input.important,
        sortOrder: 0,
        listId: input.listId,
        listName: lists.find((l) => l.id === input.listId)?.name ?? null,
        listColor: lists.find((l) => l.id === input.listId)?.color ?? null,
        pillarId: input.pillarId,
        pillarName: pillars.find((p) => p.id === input.pillarId)?.name ?? null,
        pillarColor: pillars.find((p) => p.id === input.pillarId)?.color ?? null,
        areaId: input.areaId,
        areaName: areas.find((a) => a.id === input.areaId)?.name ?? null,
        goalId: input.goalId,
        goalName: goals.find((g) => g.id === input.goalId)?.name ?? null,
        dueDate: input.dueDate,
        dueTime: input.dueTime,
        reminderOffset: input.reminderOffset,
        repeatRule: input.repeatRule,
        completedAt: null,
        archivedAt: null,
        createdAt: today,
        updatedAt: today,
        tags: input.tagNames.map((name) => ({ id: name, name })),
        steps: [],
      };
      setTasks((prev) => [created, ...prev]);
      return { ok: true as const };
    }
    return result;
  }

  function menuItemsFor(task: Task): TaskMenuItem[] {
    const items: TaskMenuItem[] = [{ label: "Edit", onSelect: () => setComposer({ mode: "edit", task }) }];
    if (activeListId) {
      items.push({ label: "Move up", onSelect: () => handleMove(task, -1) });
      items.push({ label: "Move down", onSelect: () => handleMove(task, 1) });
    }
    items.push({ label: "Add to My Day", onSelect: () => handleAddToMyDay(task) });
    items.push({ label: task.archivedAt ? "Unarchive" : "Archive", onSelect: () => handleArchiveToggle(task) });
    items.push({ label: "Delete", onSelect: () => handleDelete(task), danger: true });
    return items;
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <PrimaryButton onClick={() => setComposer({ mode: "create" })}>
          <Plus size={14} strokeWidth={2.5} /> New task
        </PrimaryButton>
      </div>

      <TaskList
        tasks={tasks}
        today={today}
        pendingIds={pendingIds}
        onToggleComplete={handleToggleComplete}
        onToggleImportant={handleToggleImportant}
        onOpen={(task) => setComposer({ mode: "edit", task })}
        menuItemsFor={menuItemsFor}
        emptyIcon={ListChecks}
        emptyMessage={emptyMessage}
        reorder={activeListId && tasks.length > 1 ? dragReorder : undefined}
      />

      {composer && (
        <TaskComposer
          mode={composer.mode}
          task={composer.task}
          lists={lists}
          pillars={pillars}
          areas={areas}
          goals={goals}
          tagSuggestions={tagSuggestions}
          defaultListId={activeListId}
          onClose={() => setComposer(null)}
          onSubmit={handleComposerSubmit}
          onToggleComplete={composer.task ? () => handleToggleComplete(composer.task!) : undefined}
          pending={composer.task ? pendingIds.has(composer.task.id) : false}
        />
      )}
    </div>
  );
}

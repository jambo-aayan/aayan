"use client";

import { useState } from "react";
import { ListChecks } from "lucide-react";
import { TaskQuickAdd, type QuickAddSubmission } from "./task-quick-add";
import { TaskList } from "./task-list";
import type { TaskMenuItem } from "./task-menu";
import { TaskComposer, type TaskFormInput } from "./task-composer";
import { useToast } from "@/components/toast/toast-provider";
import { withRetry } from "@/lib/with-retry";
import {
  createTask,
  updateTask,
  completeTask,
  uncompleteTask,
  setTaskImportant,
  archiveTask,
  deleteTask,
  restoreTask,
} from "@/lib/tasks/actions";
import type { Task } from "@/lib/tasks/types";
import type { TaskListSummary } from "@/lib/tasks/data";

/** The Area page's Tasks card — every task here is created pre-scoped to
 * this Area/Pillar, but is otherwise a completely ordinary Task: it shows
 * up in My Day, All Tasks, and By Date exactly like any other, because it
 * IS the same Task, not a separate Area-owned copy (see the cross-page
 * integration requirement this shipped against). */
export function AreaTasks({
  areaId,
  pillarId,
  initialTasks,
  lists,
  pillars,
  areas,
  goals,
  tagSuggestions,
}: {
  areaId: string;
  pillarId: string;
  initialTasks: Task[];
  lists: TaskListSummary[];
  pillars: { id: string; name: string; color?: string | null }[];
  areas: { id: string; name: string; pillarId: string }[];
  goals: { id: string; name: string; areaId: string | null }[];
  tagSuggestions: string[];
}) {
  const [tasks, setTasks] = useState(initialTasks);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [composer, setComposer] = useState<{ mode: "create" | "edit"; task?: Task } | null>(null);
  const { notifyError, notifyUndo } = useToast();
  const today = new Date();

  async function handleQuickAdd(submission: QuickAddSubmission) {
    const optimisticId = `pending-${Date.now()}`;
    const optimisticTask: Task = {
      id: optimisticId,
      title: submission.title,
      notes: null,
      status: "ACTIVE",
      important: false,
      sortOrder: 0,
      listId: null,
      listName: null,
      listColor: null,
      pillarId,
      pillarName: pillars.find((p) => p.id === pillarId)?.name ?? null,
      pillarColor: pillars.find((p) => p.id === pillarId)?.color ?? null,
      areaId,
      areaName: areas.find((a) => a.id === areaId)?.name ?? null,
      goalId: null,
      goalName: null,
      dueDate: submission.dueDate,
      dueTime: submission.dueTime,
      reminderOffset: null,
      repeatRule: null,
      completedAt: null,
      archivedAt: null,
      createdAt: today,
      updatedAt: today,
      tags: [],
      steps: [],
    };
    setTasks((prev) => [...prev, optimisticTask]);

    const result = await withRetry(() =>
      createTask(
        {
          title: submission.title,
          notes: null,
          listId: null,
          pillarId,
          areaId,
          goalId: null,
          tagNames: [],
          dueDate: submission.dueDate,
          dueTime: submission.dueTime,
          reminderOffset: null,
          repeatRule: null,
          important: false,
        },
        false
      )
    );
    if (!result.ok) {
      setTasks((prev) => prev.filter((t) => t.id !== optimisticId));
      notifyError(result.error, { onRetry: () => handleQuickAdd(submission) });
      return;
    }
    setTasks((prev) => prev.map((t) => (t.id === optimisticId ? { ...t, id: result.id } : t)));
  }

  async function handleToggleComplete(task: Task) {
    if (pendingIds.has(task.id)) return;
    setPendingIds((prev) => new Set(prev).add(task.id));
    const wasActive = task.status === "ACTIVE";
    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id
          ? { ...t, status: wasActive ? ("COMPLETED" as const) : ("ACTIVE" as const), completedAt: wasActive ? today : null }
          : t
      )
    );
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

  async function handleArchive(task: Task) {
    setTasks((prev) => prev.filter((t) => t.id !== task.id));
    const result = await withRetry(() => archiveTask(task.id));
    if (!result.ok) notifyError(result.error, { onRetry: () => handleArchive(task) });
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
    if (composer?.mode === "edit" && composer.task) {
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
        listColor: null,
        pillarId: input.pillarId,
        pillarName: pillars.find((p) => p.id === input.pillarId)?.name ?? null,
        pillarColor: null,
        areaId: input.areaId,
        areaName: areas.find((a) => a.id === input.areaId)?.name ?? null,
        goalId: input.goalId,
        goalName: null,
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
      setTasks((prev) => [...prev, created]);
      return { ok: true as const };
    }
    return result;
  }

  function menuItemsFor(task: Task): TaskMenuItem[] {
    return [
      { label: "Edit", onSelect: () => setComposer({ mode: "edit", task }) },
      { label: "Archive", onSelect: () => handleArchive(task) },
      { label: "Delete", onSelect: () => handleDelete(task), danger: true },
    ];
  }

  return (
    <div>
      <TaskQuickAdd onAdd={handleQuickAdd} />
      <TaskList
        tasks={tasks}
        today={today}
        pendingIds={pendingIds}
        onToggleComplete={handleToggleComplete}
        onToggleImportant={handleToggleImportant}
        onOpen={(task) => setComposer({ mode: "edit", task })}
        menuItemsFor={menuItemsFor}
        emptyIcon={ListChecks}
        emptyMessage="No open tasks for this area."
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
          onClose={() => setComposer(null)}
          onSubmit={handleComposerSubmit}
        />
      )}
    </div>
  );
}

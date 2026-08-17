"use client";

import { useState } from "react";
import { ListChecks, Plus } from "lucide-react";
import { TaskList } from "./task-list";
import type { TaskMenuItem } from "./task-menu";
import { TaskComposer, type TaskFormInput } from "./task-composer";
import { PrimaryButton } from "@/components/primary-button";
import { useToast } from "@/components/toast/toast-provider";
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
  addTaskToMyDay,
} from "@/lib/tasks/actions";
import type { Task } from "@/lib/tasks/types";
import type { TaskListSummary } from "@/lib/tasks/data";
import styles from "./all-tasks-view.module.css";

export function AllTasksView({
  tasks: initialTasks,
  lists,
  pillars,
  tagSuggestions,
  emptyMessage,
}: {
  tasks: Task[];
  lists: TaskListSummary[];
  pillars: { id: string; name: string }[];
  tagSuggestions: string[];
  emptyMessage: string;
}) {
  const [tasks, setTasks] = useState(initialTasks);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [composer, setComposer] = useState<{ mode: "create" | "edit"; task?: Task } | null>(null);
  const { notifyError } = useToast();
  const today = new Date();

  function setPending(id: string, pending: boolean) {
    setPendingIds((prev) => {
      const next = new Set(prev);
      if (pending) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function handleToggleComplete(task: Task) {
    if (pendingIds.has(task.id)) return;
    setPending(task.id, true);
    const wasActive = task.status === "ACTIVE";
    const apply = (list: Task[]) =>
      list.map((t) =>
        t.id === task.id
          ? { ...t, status: wasActive ? ("COMPLETED" as const) : ("ACTIVE" as const), completedAt: wasActive ? today : null }
          : t
      );
    setTasks(apply);

    const result = await withRetry(() => (wasActive ? completeTask(task.id) : uncompleteTask(task.id)));
    setPending(task.id, false);
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
    }
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
        listId: input.listId,
        listName: lists.find((l) => l.id === input.listId)?.name ?? null,
        pillarId: input.pillarId,
        pillarName: pillars.find((p) => p.id === input.pillarId)?.name ?? null,
        dueDate: input.dueDate,
        dueTime: input.dueTime,
        reminderOffset: input.reminderOffset,
        repeatRule: input.repeatRule,
        completedAt: null,
        archivedAt: null,
        createdAt: today,
        updatedAt: today,
        tags: input.tagNames.map((name) => ({ id: name, name })),
      };
      setTasks((prev) => [created, ...prev]);
      return { ok: true as const };
    }
    return result;
  }

  function menuItemsFor(task: Task): TaskMenuItem[] {
    return [
      { label: "Edit", onSelect: () => setComposer({ mode: "edit", task }) },
      { label: "Add to My Day", onSelect: () => handleAddToMyDay(task) },
      { label: task.archivedAt ? "Unarchive" : "Archive", onSelect: () => handleArchiveToggle(task) },
      { label: "Delete", onSelect: () => handleDelete(task), danger: true },
    ];
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
      />

      {composer && (
        <TaskComposer
          mode={composer.mode}
          task={composer.task}
          lists={lists}
          pillars={pillars}
          tagSuggestions={tagSuggestions}
          onClose={() => setComposer(null)}
          onSubmit={handleComposerSubmit}
        />
      )}
    </div>
  );
}

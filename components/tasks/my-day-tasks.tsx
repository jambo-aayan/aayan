"use client";

import { useState } from "react";
import { ListChecks, ChevronDown, ChevronUp, Plus } from "lucide-react";
import { TaskQuickAdd, type QuickAddSubmission } from "./task-quick-add";
import { TaskList } from "./task-list";
import type { TaskMenuItem } from "./task-menu";
import { TaskComposer, type TaskFormInput } from "./task-composer";
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
  deleteTask,
  restoreTask,
  removeTaskFromMyDay,
  addYesterdayTasksToToday,
  reorderMyDayTasks,
} from "@/lib/tasks/actions";
import type { Task } from "@/lib/tasks/types";
import type { TaskListSummary } from "@/lib/tasks/data";
import styles from "./my-day-tasks.module.css";

export function MyDayTasks({
  initialTasks,
  initialCompletedTasks,
  initialYesterdayUnfinished,
  lists,
  pillars,
  areas,
  goals = [],
  tagSuggestions,
}: {
  initialTasks: Task[];
  initialCompletedTasks: Task[];
  initialYesterdayUnfinished: Task[];
  lists: TaskListSummary[];
  pillars: { id: string; name: string; color?: string | null }[];
  areas: { id: string; name: string; pillarId: string }[];
  goals?: { id: string; name: string; areaId: string | null; pillarId?: string }[];
  tagSuggestions: string[];
}) {
  const [tasks, setTasks] = useState(initialTasks);
  const [completedTasks, setCompletedTasks] = useState(initialCompletedTasks);
  const [yesterdayUnfinished, setYesterdayUnfinished] = useState(initialYesterdayUnfinished);
  const [showCompleted, setShowCompleted] = useState(false);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [composer, setComposer] = useState<{ mode: "create" | "edit"; task?: Task } | null>(null);
  const { notifyError, notifyUndo } = useToast();
  const today = new Date();

  function setPending(id: string, pending: boolean) {
    setPendingIds((prev) => {
      const next = new Set(prev);
      if (pending) next.add(id);
      else next.delete(id);
      return next;
    });
  }

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
      pillarId: null,
      pillarName: null,
      pillarColor: null,
      areaId: null,
      areaName: null,
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
          pillarId: null,
          areaId: null,
          goalId: null,
          tagNames: [],
          dueDate: submission.dueDate,
          dueTime: submission.dueTime,
          reminderOffset: null,
          repeatRule: null,
          important: false,
        },
        true
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
    setPending(task.id, true);
    const wasActive = task.status === "ACTIVE";

    if (wasActive) {
      setTasks((prev) => prev.filter((t) => t.id !== task.id));
      setCompletedTasks((prev) => [{ ...task, status: "COMPLETED", completedAt: today }, ...prev]);
    } else {
      setCompletedTasks((prev) => prev.filter((t) => t.id !== task.id));
      setTasks((prev) => [...prev, { ...task, status: "ACTIVE", completedAt: null }]);
    }

    const result = await withRetry(() => (wasActive ? completeTask(task.id) : uncompleteTask(task.id)));
    setPending(task.id, false);
    if (!result.ok) {
      // Revert on failure.
      if (wasActive) {
        setCompletedTasks((prev) => prev.filter((t) => t.id !== task.id));
        setTasks((prev) => [...prev, task]);
      } else {
        setTasks((prev) => prev.filter((t) => t.id !== task.id));
        setCompletedTasks((prev) => [task, ...prev]);
      }
      notifyError(result.error, { onRetry: () => handleToggleComplete(task) });
    }
  }

  async function handleToggleImportant(task: Task) {
    const next = !task.important;
    const apply = (list: Task[]) => list.map((t) => (t.id === task.id ? { ...t, important: next } : t));
    setTasks(apply);
    setCompletedTasks(apply);
    const result = await withRetry(() => setTaskImportant(task.id, next));
    if (!result.ok) {
      const revert = (list: Task[]) => list.map((t) => (t.id === task.id ? { ...t, important: !next } : t));
      setTasks(revert);
      setCompletedTasks(revert);
      notifyError(result.error, { onRetry: () => handleToggleImportant(task) });
    }
  }

  async function handleRemoveFromMyDay(task: Task) {
    setTasks((prev) => prev.filter((t) => t.id !== task.id));
    const result = await withRetry(() => removeTaskFromMyDay(task.id));
    if (!result.ok) {
      setTasks((prev) => [...prev, task]);
      notifyError(result.error, { onRetry: () => handleRemoveFromMyDay(task) });
    }
  }

  async function handleArchive(task: Task) {
    setTasks((prev) => prev.filter((t) => t.id !== task.id));
    setCompletedTasks((prev) => prev.filter((t) => t.id !== task.id));
    const result = await withRetry(() => archiveTask(task.id));
    if (!result.ok) {
      notifyError(result.error, { onRetry: () => handleArchive(task) });
    }
  }

  async function handleDelete(task: Task) {
    const wasCompleted = task.status === "COMPLETED";
    setTasks((prev) => prev.filter((t) => t.id !== task.id));
    setCompletedTasks((prev) => prev.filter((t) => t.id !== task.id));
    const result = await withRetry(() => deleteTask(task.id));
    if (!result.ok) {
      if (wasCompleted) setCompletedTasks((prev) => [task, ...prev]);
      else setTasks((prev) => [...prev, task]);
      notifyError(result.error, { onRetry: () => handleDelete(task) });
      return;
    }
    notifyUndo(`Deleted "${task.title}".`, () => handleUndoDelete(task, wasCompleted));
  }

  async function handleUndoDelete(task: Task, wasCompleted: boolean) {
    const result = await withRetry(() => restoreTask(task.id));
    if (!result.ok) {
      notifyError(result.error, { onRetry: () => handleUndoDelete(task, wasCompleted) });
      return;
    }
    if (wasCompleted) setCompletedTasks((prev) => [task, ...prev]);
    else setTasks((prev) => [...prev, task]);
  }

  async function handleAddYesterday() {
    const ids = yesterdayUnfinished.map((t) => t.id);
    setTasks((prev) => [...prev, ...yesterdayUnfinished]);
    setYesterdayUnfinished([]);
    const result = await withRetry(() => addYesterdayTasksToToday(ids));
    if (!result.ok) {
      notifyError(result.error);
    }
  }

  /** My Day's own manual order — independent of each task's List order (see
   * Task's schema comment). Backed by the same commit path whether the user
   * drags a row or uses the Move up/down menu items (kept for keyboard/
   * no-pointer access). */
  async function commitReorder(reordered: Task[]) {
    const previous = tasks;
    setTasks(reordered);
    const result = await withRetry(() => reorderMyDayTasks(reordered.map((t) => t.id)));
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
        const apply = (list: Task[]) => list.map((t) => (t.id === merged.id ? merged : t));
        setTasks(apply);
        setCompletedTasks(apply);
      }
      return result;
    }

    const result = await createTask(input, true);
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
      setTasks((prev) => [...prev, created]);
      return { ok: true as const };
    }
    return result;
  }

  const totalCount = tasks.length + completedTasks.length;

  function menuItemsFor(task: Task, isCompleted: boolean): TaskMenuItem[] {
    const items: TaskMenuItem[] = [{ label: "Edit", onSelect: () => setComposer({ mode: "edit", task }) }];
    if (!isCompleted) {
      items.push({ label: "Move up", onSelect: () => handleMove(task, -1) });
      items.push({ label: "Move down", onSelect: () => handleMove(task, 1) });
      items.push({ label: "Remove from My Day", onSelect: () => handleRemoveFromMyDay(task) });
    }
    items.push({ label: "Archive", onSelect: () => handleArchive(task) });
    items.push({ label: "Delete", onSelect: () => handleDelete(task), danger: true });
    return items;
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <h3 className={styles.heading}>
          My Day{totalCount > 0 && <span className={styles.count}>{totalCount}</span>}
        </h3>
        {totalCount > 0 && (
          <span className={styles.progress}>
            {completedTasks.length}/{totalCount} completed
          </span>
        )}
      </div>

      <TaskQuickAdd onAdd={handleQuickAdd} />

      {yesterdayUnfinished.length > 0 && (
        <div className={styles.banner}>
          <span>
            {yesterdayUnfinished.length} unfinished task{yesterdayUnfinished.length === 1 ? "" : "s"} from yesterday
          </span>
          <button type="button" className={styles.bannerAction} onClick={handleAddYesterday}>
            Add to today
          </button>
        </div>
      )}

      <TaskList
        tasks={tasks}
        today={today}
        pendingIds={pendingIds}
        onToggleComplete={handleToggleComplete}
        onToggleImportant={handleToggleImportant}
        onOpen={(task) => setComposer({ mode: "edit", task })}
        menuItemsFor={(task) => menuItemsFor(task, false)}
        emptyIcon={ListChecks}
        emptyMessage="Nothing planned yet."
        reorder={tasks.length > 1 ? dragReorder : undefined}
      />

      {completedTasks.length > 0 && (
        <div className={styles.completedSection}>
          <button type="button" className={styles.completedToggle} onClick={() => setShowCompleted((v) => !v)}>
            {showCompleted ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            Show completed ({completedTasks.length})
          </button>
          {showCompleted && (
            <TaskList
              tasks={completedTasks}
              today={today}
              pendingIds={pendingIds}
              onToggleComplete={handleToggleComplete}
              onToggleImportant={handleToggleImportant}
              onOpen={(task) => setComposer({ mode: "edit", task })}
              menuItemsFor={(task) => menuItemsFor(task, true)}
              emptyIcon={ListChecks}
              emptyMessage="No completed tasks yet."
            />
          )}
        </div>
      )}

      <button
        type="button"
        className={styles.fab}
        onClick={() => setComposer({ mode: "create" })}
        aria-label="New task"
      >
        <Plus size={22} strokeWidth={2.25} />
      </button>

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

import type { LucideIcon } from "lucide-react";
import { TaskRow } from "./task-row";
import type { TaskMenuItem } from "./task-menu";
import { EmptyState } from "@/components/empty-state";
import type { Task } from "@/lib/tasks/types";
import styles from "./task-list.module.css";

export type TaskListReorder = {
  draggingId: string | null;
  registerRow: (id: string, el: HTMLElement | null) => void;
  handlePointerDown: (id: string) => (e: React.PointerEvent) => void;
  handlePointerMove: (e: React.PointerEvent) => void;
  handlePointerUp: (e: React.PointerEvent) => void;
};

export function TaskList({
  tasks,
  today,
  pendingIds,
  onToggleComplete,
  onToggleImportant,
  onOpen,
  menuItemsFor,
  emptyIcon,
  emptyMessage,
  reorder,
}: {
  tasks: Task[];
  today: Date;
  pendingIds?: Set<string>;
  onToggleComplete: (task: Task) => void;
  onToggleImportant: (task: Task) => void;
  onOpen: (task: Task) => void;
  menuItemsFor: (task: Task) => TaskMenuItem[];
  emptyIcon: LucideIcon;
  emptyMessage: string;
  /** Enables the drag handle + pointer-based reordering (see
   * use-drag-reorder.ts). Omitted where reordering isn't meaningful, e.g.
   * a view spanning multiple Lists where List-scoped sortOrder doesn't
   * apply to the mixed set being shown. */
  reorder?: TaskListReorder;
}) {
  if (tasks.length === 0) {
    return <EmptyState icon={emptyIcon} message={emptyMessage} />;
  }

  return (
    <ul className={styles.list}>
      {tasks.map((task) => (
        <TaskRow
          key={task.id}
          task={task}
          today={today}
          pending={pendingIds?.has(task.id)}
          onToggleComplete={() => onToggleComplete(task)}
          onToggleImportant={() => onToggleImportant(task)}
          onOpen={() => onOpen(task)}
          extraMenuItems={menuItemsFor(task)}
          drag={
            reorder
              ? {
                  dragging: reorder.draggingId === task.id,
                  registerRow: (el) => reorder.registerRow(task.id, el),
                  onHandlePointerDown: reorder.handlePointerDown(task.id),
                  onHandlePointerMove: reorder.handlePointerMove,
                  onHandlePointerUp: reorder.handlePointerUp,
                }
              : undefined
          }
        />
      ))}
    </ul>
  );
}

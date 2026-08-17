import type { LucideIcon } from "lucide-react";
import { TaskRow } from "./task-row";
import type { TaskMenuItem } from "./task-menu";
import { EmptyState } from "@/components/empty-state";
import type { Task } from "@/lib/tasks/types";
import styles from "./task-list.module.css";

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
        />
      ))}
    </ul>
  );
}

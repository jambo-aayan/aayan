import { Star } from "lucide-react";
import { TaskCheckbox } from "./task-checkbox";
import { TaskMenu, type TaskMenuItem } from "./task-menu";
import { formatDueBadge } from "@/lib/tasks/format";
import type { Task } from "@/lib/tasks/types";
import styles from "./task-row.module.css";

export function TaskRow({
  task,
  today,
  pending,
  onToggleComplete,
  onToggleImportant,
  onOpen,
  extraMenuItems,
}: {
  task: Task;
  today: Date;
  pending?: boolean;
  onToggleComplete: () => void;
  onToggleImportant: () => void;
  onOpen: () => void;
  extraMenuItems: TaskMenuItem[];
}) {
  const done = task.status === "COMPLETED";
  const due = formatDueBadge(task.dueDate, task.dueTime, today);
  const metaParts = [task.listName, task.pillarName].filter(Boolean) as string[];

  return (
    <li className={styles.row}>
      <div className={styles.checkboxCol}>
        <TaskCheckbox
          checked={done}
          onToggle={onToggleComplete}
          disabled={pending}
          label={done ? `Mark "${task.title}" not done` : `Mark "${task.title}" done`}
        />
      </div>
      <button type="button" className={styles.body} onClick={onOpen}>
        <div className={styles.titleRow}>
          <span className={done ? styles.titleDone : styles.title}>{task.title}</span>
        </div>
        {(metaParts.length > 0 || task.tags.length > 0) && (
          <div className={styles.meta}>
            {metaParts.length > 0 && <span>{metaParts.join(" · ")}</span>}
            {task.tags.length > 0 && (
              <span className={metaParts.length > 0 ? styles.metaDot : undefined}>
                {task.tags.map((t) => (
                  <span key={t.id} className={styles.tag}>
                    #{t.name}{" "}
                  </span>
                ))}
              </span>
            )}
          </div>
        )}
      </button>
      <div className={styles.side}>
        {due && (
          <span
            className={`${styles.due} ${due.variant === "overdue" ? styles.dueOverdue : ""} ${
              due.variant === "today" ? styles.dueToday : ""
            }`}
          >
            {due.label}
          </span>
        )}
        <button
          type="button"
          className={`${styles.star} ${task.important ? styles.starActive : ""}`}
          onClick={onToggleImportant}
          aria-pressed={task.important}
          aria-label={task.important ? "Unmark as important" : "Mark as important"}
        >
          <Star size={15} strokeWidth={2} fill={task.important ? "currentColor" : "none"} />
        </button>
        <TaskMenu items={extraMenuItems} />
      </div>
    </li>
  );
}

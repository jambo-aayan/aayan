import { Star, GripVertical } from "lucide-react";
import { TaskCheckbox } from "./task-checkbox";
import { TaskMenu, type TaskMenuItem } from "./task-menu";
import { formatDueBadge } from "@/lib/tasks/format";
import { resolveColorHex, type ColorKey } from "@/lib/colors";
import type { Task } from "@/lib/tasks/types";
import styles from "./task-row.module.css";

export type TaskRowDragProps = {
  dragging: boolean;
  registerRow: (el: HTMLElement | null) => void;
  onHandlePointerDown: (e: React.PointerEvent) => void;
  onHandlePointerMove: (e: React.PointerEvent) => void;
  onHandlePointerUp: (e: React.PointerEvent) => void;
};

export function TaskRow({
  task,
  today,
  pending,
  onToggleComplete,
  onToggleImportant,
  onOpen,
  extraMenuItems,
  drag,
}: {
  task: Task;
  today: Date;
  pending?: boolean;
  onToggleComplete: () => void;
  onToggleImportant: () => void;
  onOpen: () => void;
  extraMenuItems: TaskMenuItem[];
  drag?: TaskRowDragProps;
}) {
  const done = task.status === "COMPLETED";
  const due = formatDueBadge(task.dueDate, task.dueTime, today);
  const listHex = resolveColorHex(task.listColor as ColorKey | null);
  const pillarHex = resolveColorHex(task.pillarColor as ColorKey | null);
  // Area communicates Pillar context on its own, so once a task has an Area
  // we don't also show its (usually redundant) Pillar — see task row spec:
  // "Pillar usually hidden if Area already communicates context".
  const secondaryLabel = task.areaName ?? task.pillarName;
  const hasMeta = task.listName || secondaryLabel || task.tags.length > 0 || due;

  return (
    <li
      className={`${styles.row} ${drag?.dragging ? styles.dragging : ""}`}
      ref={drag ? (el) => drag.registerRow(el) : undefined}
      style={pillarHex ? { borderLeft: `3px solid ${pillarHex}55` } : undefined}
    >
      {/* Grip space is always reserved, even in mixed views where dragging
       * doesn't apply — a row with no grip button would visually shift left
       * relative to a row with one, which reads as misaligned when the two
       * kinds of view sit near each other. See task row spec: "Hidden
       * (transparent) in mixed views where ordering is meaningless". */}
      <div className={styles.gripCol}>
        {drag && (
          <button
            type="button"
            className={styles.grip}
            aria-label={`Reorder "${task.title}"`}
            onPointerDown={drag.onHandlePointerDown}
            onPointerMove={drag.onHandlePointerMove}
            onPointerUp={drag.onHandlePointerUp}
            onPointerCancel={drag.onHandlePointerUp}
          >
            <GripVertical size={13} strokeWidth={2} />
          </button>
        )}
      </div>
      <div className={styles.checkboxCol}>
        <TaskCheckbox
          checked={done}
          onToggle={onToggleComplete}
          disabled={pending}
          label={done ? `Mark "${task.title}" not done` : `Mark "${task.title}" done`}
          accentColor={pillarHex}
        />
      </div>
      <button type="button" className={styles.body} onClick={onOpen}>
        <div className={styles.titleRow}>
          <span className={done ? styles.titleDone : styles.title}>{task.title}</span>
        </div>
        {hasMeta && (
          <div className={styles.meta}>
            {task.listName && (
              <span
                className={`${styles.metaItem} ${styles.listPill}`}
                style={listHex ? { background: `${listHex}22`, borderColor: `${listHex}38`, color: listHex } : undefined}
              >
                {task.listName}
              </span>
            )}
            {secondaryLabel && (
              <span className={`${styles.metaItem} ${styles.area}`} style={pillarHex ? { color: pillarHex } : undefined}>
                {secondaryLabel}
              </span>
            )}
            {task.tags.map((t) => (
              <span key={t.id} className={`${styles.metaItem} ${styles.tag}`}>
                #{t.name}
              </span>
            ))}
            {due && (
              <span
                className={`${styles.metaItem} ${styles.due} ${due.variant === "overdue" ? styles.dueOverdue : ""} ${
                  due.variant === "today" ? styles.dueToday : ""
                }`}
              >
                {due.label}
              </span>
            )}
          </div>
        )}
      </button>
      <div className={styles.side}>
        <button
          type="button"
          className={`${styles.star} ${task.important ? styles.starActive : ""}`}
          onClick={onToggleImportant}
          aria-pressed={task.important}
          aria-label={task.important ? "Unmark as important" : "Mark as important"}
        >
          <Star size={14} strokeWidth={2} fill={task.important ? "currentColor" : "none"} />
        </button>
        <TaskMenu items={extraMenuItems} />
      </div>
    </li>
  );
}

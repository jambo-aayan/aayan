import { STATUS_LABEL, type GoalStatus } from "@/lib/action-goals/status";
import styles from "./all-actions-list.module.css";

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

export function AllActionsList({
  goals,
}: {
  goals: { id: string; name: string; areaName: string; status: GoalStatus; dueDate: Date | null }[];
}) {
  if (goals.length === 0) {
    return <p className={styles.empty}>No backlog goals — everything&rsquo;s either done or in My Day.</p>;
  }

  return (
    <ul className={styles.list}>
      {goals.map((goal) => (
        <li key={goal.id} className={styles.row}>
          <div className={styles.name}>{goal.name}</div>
          <div className={styles.meta}>
            {goal.areaName} · {STATUS_LABEL[goal.status]}
            {goal.dueDate && ` · due ${formatDate(goal.dueDate)}`}
          </div>
        </li>
      ))}
    </ul>
  );
}

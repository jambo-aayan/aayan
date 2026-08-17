import { PageHeader } from "@/components/page-header";
import pageStyles from "@/components/page-header.module.css";
import { Card } from "@/components/card";
import { SectionHeader } from "@/components/section-header";
import { getEveryGoal } from "@/lib/action-goals/data";
import { groupActionsByDueDate } from "@/lib/home/by-date";
import { STATUS_LABEL } from "@/lib/action-goals/status";
import { getActiveTasksForByDate } from "@/lib/tasks/data";
import { groupTasksByDate } from "@/lib/tasks/date-groups";
import { formatDueBadge } from "@/lib/tasks/format";
import styles from "./by-date.module.css";

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(
    date
  );
}

const TASK_GROUP_LABEL = {
  overdue: "Overdue",
  today: "Today",
  tomorrow: "Tomorrow",
  thisWeek: "This week",
  later: "Later",
  noDueDate: "No due date",
} as const;

export default async function ByDatePage() {
  const now = new Date();
  const [goals, tasks] = await Promise.all([getEveryGoal(), getActiveTasksForByDate()]);
  const goalGroups = groupActionsByDueDate(goals);
  const taskGroups = groupTasksByDate(tasks, now);

  return (
    <>
      <PageHeader title="By Date" backHref="/today" />
      <div className={pageStyles.content}>
        <SectionHeader>Tasks</SectionHeader>
        <Card>
          {tasks.length === 0 ? (
            <p className={styles.empty}>No tasks yet.</p>
          ) : (
            (Object.keys(TASK_GROUP_LABEL) as (keyof typeof TASK_GROUP_LABEL)[]).map((key) => {
              const group = taskGroups[key];
              if (group.length === 0) return null;
              return (
                <div key={key} className={styles.group}>
                  <div className={styles.date}>{TASK_GROUP_LABEL[key]}</div>
                  <ul className={styles.list}>
                    {group.map((task) => {
                      const due = formatDueBadge(task.dueDate, task.dueTime, now);
                      return (
                        <li key={task.id} className={styles.row}>
                          <span className={styles.name}>{task.title}</span>
                          <span className={styles.meta}>
                            {[task.listName, task.pillarName].filter(Boolean).join(" · ")}
                            {due && key !== "today" && key !== "tomorrow" ? ` · ${due.label}` : ""}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })
          )}
        </Card>

        <SectionHeader>Goals</SectionHeader>
        <Card>
          {goalGroups.length === 0 ? (
            <p className={styles.empty}>No Goals with a due date yet.</p>
          ) : (
            goalGroups.map((group) => (
              <div key={group.date.toISOString()} className={styles.group}>
                <div className={styles.date}>{formatDate(group.date)}</div>
                <ul className={styles.list}>
                  {group.goals.map((goal) => (
                    <li key={goal.id} className={styles.row}>
                      <span className={styles.name}>{goal.name}</span>
                      <span className={styles.meta}>
                        {goal.areaName} · {STATUS_LABEL[goal.status]}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </Card>
      </div>
    </>
  );
}

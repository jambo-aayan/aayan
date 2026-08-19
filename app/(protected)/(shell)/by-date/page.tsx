import { PageHeader } from "@/components/page-header";
import pageStyles from "@/components/page-header.module.css";
import { Card } from "@/components/card";
import { getActiveTasksForByDate } from "@/lib/tasks/data";
import { groupTasksByDate } from "@/lib/tasks/date-groups";
import { formatDueBadge } from "@/lib/tasks/format";
import styles from "./by-date.module.css";

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
  const tasks = await getActiveTasksForByDate();
  const taskGroups = groupTasksByDate(tasks, now);

  return (
    <>
      <PageHeader title="By Date" backHref="/today" />
      <div className={pageStyles.content}>
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
                            {[task.listName, task.areaName ?? task.pillarName].filter(Boolean).join(" · ")}
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
      </div>
    </>
  );
}

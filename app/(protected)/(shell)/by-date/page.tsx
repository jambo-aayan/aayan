import { PageHeader } from "@/components/page-header";
import pageStyles from "@/components/page-header.module.css";
import { Card } from "@/components/card";
import { getEveryGoal } from "@/lib/action-goals/data";
import { groupActionsByDueDate } from "@/lib/home/by-date";
import { STATUS_LABEL } from "@/lib/action-goals/status";
import styles from "./by-date.module.css";

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(
    date
  );
}

export default async function ByDatePage() {
  const goals = await getEveryGoal();
  const groups = groupActionsByDueDate(goals);

  return (
    <>
      <PageHeader title="By Date" backHref="/today" />
      <div className={pageStyles.content}>
        <Card>
          {groups.length === 0 ? (
            <p className={styles.empty}>No Goals with a due date yet.</p>
          ) : (
            groups.map((group) => (
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

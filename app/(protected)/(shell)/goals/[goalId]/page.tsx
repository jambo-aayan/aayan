import { notFound } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import pageStyles from "@/components/page-header.module.css";
import { Card } from "@/components/card";
import { GoalStatusControl } from "@/components/goals/goal-status-control";
import { getGoalDetail } from "@/lib/goals/data";
import { resolveColorHex, type ColorKey } from "@/lib/colors";
import styles from "./goal-detail.module.css";

export default async function GoalDetailPage({ params }: { params: Promise<{ goalId: string }> }) {
  const { goalId } = await params;
  const detail = await getGoalDetail(goalId);
  if (!detail) notFound();

  const { goal, tasks, habits } = detail;
  const hex = resolveColorHex(goal.pillarColor as ColorKey | null);
  const activeHabits = habits.filter((h) => h.status === "ACTIVE");
  const pausedHabits = habits.filter((h) => h.status === "PAUSED");
  const openTasks = tasks.filter((t) => t.status === "ACTIVE");
  const completedTasks = tasks.filter((t) => t.status === "COMPLETED");

  return (
    <>
      <PageHeader title={goal.name} backHref="/goals" />
      <div className={pageStyles.content}>
        <Card>
          <div className={styles.headRow}>
            <span className={styles.pillarPill} style={{ background: hex ? `${hex}22` : "var(--bg2)", color: hex ?? "var(--muted)" }}>
              {goal.pillarName}
            </span>
            {goal.areaName && <span className={styles.areaPill}>{goal.areaName}</span>}
          </div>
          <GoalStatusControl goalId={goal.id} initialStatus={goal.status} />
        </Card>

        <Card title={`Habits (${activeHabits.length} active, ${pausedHabits.length} paused)`}>
          {habits.length === 0 ? (
            <p className={styles.empty}>No habits linked to this goal yet.</p>
          ) : (
            <ul className={styles.list}>
              {habits.map((h) => (
                <li key={h.id} className={styles.row}>
                  <Link href="/habits" className={styles.rowName}>
                    {h.isPrimary && "★ "}
                    {h.name}
                  </Link>
                  <span className={styles.rowMeta}>{h.status === "ACTIVE" ? "Active" : h.status === "PAUSED" ? "Paused" : "Archived"}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title={`Tasks (${openTasks.length} open, ${completedTasks.length} completed)`}>
          {tasks.length === 0 ? (
            <p className={styles.empty}>No tasks linked to this goal yet.</p>
          ) : (
            <ul className={styles.list}>
              {tasks.map((t) => (
                <li key={t.id} className={styles.row}>
                  <Link href={`/tasks?goalId=${goal.id}`} className={`${styles.rowName} ${t.status === "COMPLETED" ? styles.done : ""}`}>
                    {t.important && "★ "}
                    {t.title}
                  </Link>
                  <span className={styles.rowMeta}>{t.listName ?? "Inbox"}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

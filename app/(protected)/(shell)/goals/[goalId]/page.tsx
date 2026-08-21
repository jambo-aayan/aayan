import { notFound } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import pageStyles from "@/components/page-header.module.css";
import { BackLink } from "@/components/back-link";
import { Card } from "@/components/card";
import { HabitDot } from "@/components/habit-dot";
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
      <PageHeader backHref="/goals" />
      <div className={pageStyles.content}>
        <BackLink href="/goals" label="Goals" />
        <Card>
          <div className={styles.headRow}>
            <span className={styles.pillarPill} style={{ background: hex ? `${hex}22` : "var(--bg2)", color: hex ?? "var(--muted)" }}>
              {goal.pillarName}
            </span>
            {goal.areaName && <span className={styles.areaPill}>{goal.areaName}</span>}
          </div>
          <h1 className={styles.goalName}>{goal.name}</h1>
          <GoalStatusControl goalId={goal.id} initialStatus={goal.status} />
        </Card>

        <Card title="Habits">
          {habits.length === 0 ? (
            <p className={styles.empty}>No habits linked to this goal yet.</p>
          ) : (
            <>
              {activeHabits.length > 0 && (
                <ul className={styles.habitList}>
                  {activeHabits.map((h) => (
                    <li key={h.id} className={styles.habitRow}>
                      <HabitDot level={h.todayLevel} accentColor={hex} size={20} />
                      <Link href="/habits" className={styles.rowName}>
                        {h.isPrimary && "★ "}
                        {h.name}
                      </Link>
                      <span className={styles.rowMeta}>{h.streak} day streak</span>
                    </li>
                  ))}
                </ul>
              )}
              {pausedHabits.length > 0 && (
                <>
                  <div className={styles.subHeading}>Paused</div>
                  <ul className={styles.habitList}>
                    {pausedHabits.map((h) => (
                      <li key={h.id} className={`${styles.habitRow} ${styles.inactive}`}>
                        <Link href="/habits" className={styles.rowName}>
                          {h.isPrimary && "★ "}
                          {h.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </>
          )}
        </Card>

        <Card title="Tasks">
          <div className={styles.taskCounts}>
            <div>
              <div className={styles.taskCountNum}>{openTasks.length}</div>
              <div className={styles.taskCountLabel}>Open</div>
            </div>
            <div>
              <div className={styles.taskCountNum}>{completedTasks.length}</div>
              <div className={styles.taskCountLabel}>Completed</div>
            </div>
          </div>
          {tasks.length > 0 && (
            <ul className={styles.list}>
              {tasks.map((t) => (
                <li key={t.id} className={styles.row}>
                  <span className={`${styles.rowName} ${t.status === "COMPLETED" ? styles.done : ""}`}>
                    {t.important && "★ "}
                    {t.title}
                  </span>
                  <span className={styles.rowMeta}>{t.listName ?? "Inbox"}</span>
                </li>
              ))}
            </ul>
          )}
          <Link href={`/tasks?goalId=${goal.id}`} className={styles.openInTasks}>
            Open in Tasks, filtered to this goal →
          </Link>
        </Card>
      </div>
    </>
  );
}

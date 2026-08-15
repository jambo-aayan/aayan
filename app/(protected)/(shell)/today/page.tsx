import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import pageStyles from "@/components/page-header.module.css";
import { Card } from "@/components/card";
import { MyDayHabits } from "@/components/my-day-habits";
import { MyDayGoals } from "@/components/my-day-goals";
import { ThoughtQuickAdd } from "@/components/thoughts/thought-quick-add";
import { getMyDayHabits, getEveryGoal } from "@/lib/action-goals/data";
import { getTagOptions } from "@/lib/thoughts/data";
import { habitsNotCheckedIn, todaysGoals } from "@/lib/home/today";
import styles from "./today.module.css";

export default async function TodayPage() {
  const [allHabits, goals, tagOptions] = await Promise.all([getMyDayHabits(), getEveryGoal(), getTagOptions()]);

  const dueHabits = habitsNotCheckedIn(allHabits);
  const dueGoals = todaysGoals(goals, new Date());

  return (
    <>
      <PageHeader title="Today" />
      <div className={pageStyles.content}>
        <Card title="Habits">
          {dueHabits.length === 0 ? (
            <p className={styles.empty}>
              {allHabits.length === 0 ? "No active habits yet." : "All habits checked in for today."}
            </p>
          ) : (
            <MyDayHabits initialHabits={dueHabits} />
          )}
        </Card>
        <Card title="Goals">
          {dueGoals.length === 0 ? (
            <p className={styles.empty}>Nothing flagged for today.</p>
          ) : (
            <MyDayGoals initialGoals={dueGoals} />
          )}
        </Card>
        <div className={styles.crossCutting}>
          <Link href="/pillars" className={styles.crossLink}>
            Pillars
          </Link>
          <Link href="/my-day" className={styles.crossLink}>
            My Day
          </Link>
          <Link href="/all-actions" className={styles.crossLink}>
            All Actions
          </Link>
          <Link href="/by-date" className={styles.crossLink}>
            By Date
          </Link>
          <Link href="/thoughts" className={styles.crossLink}>
            Thoughts
          </Link>
        </div>
        <Card title="Quick thought">
          <ThoughtQuickAdd tagOptions={tagOptions} />
        </Card>
      </div>
    </>
  );
}

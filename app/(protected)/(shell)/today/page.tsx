import { CheckCircle2, Flag } from "lucide-react";
import pageStyles from "@/components/page-header.module.css";
import { TodayHeader } from "@/components/today-header";
import { SectionHeader } from "@/components/section-header";
import { DashboardCard } from "@/components/dashboard-card";
import { TodaySectionPills } from "@/components/nav-pills";
import { Card } from "@/components/card";
import { ThoughtQuickAdd } from "@/components/thoughts/thought-quick-add";
import { getMyDayHabits, getEveryGoal } from "@/lib/action-goals/data";
import { getTagOptions } from "@/lib/thoughts/data";
import { habitsNotCheckedIn, todaysGoals } from "@/lib/home/today";
import styles from "./today.module.css";

function habitsStatus(allCount: number, dueCount: number): string {
  if (allCount === 0) return "No active habits yet.";
  if (dueCount === 0) return "All checked in for today.";
  return `${dueCount} left to check in`;
}

function goalsStatus(dueGoals: { status: string }[]): string {
  if (dueGoals.length === 0) return "Nothing flagged for today.";
  const remaining = dueGoals.filter((g) => g.status !== "DONE").length;
  if (remaining === 0) return "All done for today.";
  return `${remaining} of ${dueGoals.length} flagged for today`;
}

export default async function TodayPage() {
  const [allHabits, goals, tagOptions] = await Promise.all([getMyDayHabits(), getEveryGoal(), getTagOptions()]);

  const dueHabits = habitsNotCheckedIn(allHabits);
  const dueGoals = todaysGoals(goals, new Date());

  return (
    <>
      <TodayHeader name="Aayan" now={new Date()} />
      <div className={pageStyles.content}>
        <SectionHeader>Your day</SectionHeader>
        <div className={styles.summaryRow}>
          <DashboardCard
            href="/my-day"
            icon={CheckCircle2}
            accent="health"
            title="Habits"
            status={habitsStatus(allHabits.length, dueHabits.length)}
          />
          <DashboardCard
            href="/my-day"
            icon={Flag}
            accent="finance"
            title="Goals"
            status={goalsStatus(dueGoals)}
          />
        </div>

        <div className={styles.pillsWrap}>
          <TodaySectionPills />
        </div>

        <Card>
          <ThoughtQuickAdd tagOptions={tagOptions} />
        </Card>
      </div>
    </>
  );
}

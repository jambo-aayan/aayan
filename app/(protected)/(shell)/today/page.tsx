import { CheckCircle2, Flag } from "lucide-react";
import pageStyles from "@/components/page-header.module.css";
import { TodayHeader } from "@/components/today-header";
import { SectionHeader } from "@/components/section-header";
import { StatCard } from "@/components/stat-card";
import { TodaySectionPills } from "@/components/nav-pills";
import { Card } from "@/components/card";
import { ThoughtQuickAdd } from "@/components/thoughts/thought-quick-add";
import { MyDayTasks } from "@/components/tasks/my-day-tasks";
import { getHabitOccurrencesForDate } from "@/lib/habits/data";
import { getAllGoals } from "@/lib/goals/data";
import { getTagOptions } from "@/lib/thoughts/data";
import { habitsNotCheckedIn } from "@/lib/home/today";
import { resolveColorHex, type ColorKey } from "@/lib/colors";
import {
  getMyDayTasks,
  getTodayCompletedTasks,
  getYesterdayUnfinishedTasks,
  getTaskLists,
  getPillarOptions,
  getAreaOptions,
  getTaskTags,
} from "@/lib/tasks/data";
import styles from "./today.module.css";

function habitsClause(occurringCount: number, dueCount: number): string {
  if (occurringCount === 0) return "Nothing scheduled today.";
  if (dueCount === 0) return "All checked in for today.";
  return "left to check in today";
}

function goalsClause(activeCount: number): string {
  return activeCount === 0 ? "No active goals yet." : "active";
}

export default async function TodayPage() {
  const now = new Date();
  const [
    todaysHabits,
    activeGoals,
    tagOptions,
    myDayTasks,
    completedTasks,
    yesterdayUnfinished,
    taskLists,
    pillarOptions,
    areaOptions,
    taskTags,
  ] = await Promise.all([
    getHabitOccurrencesForDate(now),
    getAllGoals({ status: "ACTIVE" }),
    getTagOptions(),
    getMyDayTasks(now),
    getTodayCompletedTasks(now),
    getYesterdayUnfinishedTasks(now),
    getTaskLists(),
    getPillarOptions(),
    getAreaOptions(),
    getTaskTags(),
  ]);

  const dueHabits = habitsNotCheckedIn(todaysHabits);
  const myDayHabits = todaysHabits.map((h) => ({
    id: h.id,
    name: h.name,
    todayLevel: h.todayLevel,
    pillarColor: resolveColorHex(h.pillarColor as ColorKey | null),
  }));

  return (
    <>
      <TodayHeader name="Aayan" now={now} />
      <div className={pageStyles.content}>
        <SectionHeader>Your day</SectionHeader>
        <div className={styles.summaryRow}>
          <StatCard
            href="/habits"
            icon={CheckCircle2}
            accent="health"
            label="Habits"
            value={dueHabits.length}
            clause={habitsClause(todaysHabits.length, dueHabits.length)}
          />
          <StatCard
            href="/goals"
            icon={Flag}
            accent="finance"
            label="Goals"
            value={activeGoals.length}
            clause={goalsClause(activeGoals.length)}
          />
        </div>

        <div className={styles.pillsWrap}>
          <TodaySectionPills />
        </div>

        <Card>
          <MyDayTasks
            initialTasks={myDayTasks}
            initialCompletedTasks={completedTasks}
            initialYesterdayUnfinished={yesterdayUnfinished}
            initialHabits={myDayHabits}
            lists={taskLists}
            pillars={pillarOptions}
            areas={areaOptions}
            tagSuggestions={taskTags.map((t) => t.name)}
          />
        </Card>

        <Card>
          <ThoughtQuickAdd tagOptions={tagOptions} />
        </Card>
      </div>
    </>
  );
}

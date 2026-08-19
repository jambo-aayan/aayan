import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import pageStyles from "@/components/page-header.module.css";
import { Card } from "@/components/card";
import { HabitsFilters } from "@/components/habits/habits-filters";
import { HabitManager } from "@/components/habits/habit-manager";
import { getAllHabits } from "@/lib/habits/data";
import { getPillarOptions, getAreaOptions } from "@/lib/tasks/data";
import { getGoalOptions } from "@/lib/goals/data";

export default async function HabitsPage({
  searchParams,
}: {
  searchParams: Promise<{ pillarId?: string; areaId?: string; goalId?: string; status?: string }>;
}) {
  const params = await searchParams;
  const status =
    params.status === "ACTIVE" || params.status === "PAUSED" || params.status === "ARCHIVED" ? params.status : undefined;

  const [allHabits, pillars, areas, goals] = await Promise.all([
    getAllHabits({
      pillarId: params.pillarId || undefined,
      areaId: params.areaId || undefined,
      goalId: params.goalId || undefined,
      status,
    }),
    getPillarOptions(),
    getAreaOptions(),
    getGoalOptions(),
  ]);

  // Archived habits stay out of the default view — they remain stored and
  // reachable, but only when explicitly filtered for (see Habit's schema
  // comment on ARCHIVED staying hidden from normal management).
  const habits = status ? allHabits : allHabits.filter((h) => h.status !== "ARCHIVED");

  return (
    <>
      <PageHeader title="Habits" backHref="/today" />
      <div className={pageStyles.content}>
        <Suspense fallback={null}>
          <HabitsFilters pillars={pillars} areas={areas} goals={goals} />
        </Suspense>
        <Card>
          <HabitManager
            key={`${params.pillarId ?? ""}:${params.areaId ?? ""}:${params.goalId ?? ""}:${params.status ?? ""}`}
            habits={habits}
            pillars={pillars}
            areas={areas}
            goals={goals}
            emptyMessage="No habits match these filters yet."
          />
        </Card>
      </div>
    </>
  );
}

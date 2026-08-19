import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import pageStyles from "@/components/page-header.module.css";
import { Card } from "@/components/card";
import { GoalsFilters } from "@/components/goals/goals-filters";
import { GoalManager } from "@/components/goals/goal-manager";
import { getAllGoals } from "@/lib/goals/data";
import { getPillarOptions, getAreaOptions } from "@/lib/tasks/data";

export default async function GoalsPage({
  searchParams,
}: {
  searchParams: Promise<{ pillarId?: string; areaId?: string; status?: string }>;
}) {
  const params = await searchParams;
  const status =
    params.status === "ACTIVE" || params.status === "PAUSED" || params.status === "COMPLETED" || params.status === "ARCHIVED"
      ? params.status
      : undefined;

  // "__none__" is the drilldown/filter's stand-in for "no Area" — not a
  // real Area id, so it's applied as a post-filter rather than passed to
  // the query (see GoalManager's Level 1 "No area" tile).
  const wantsNoArea = params.areaId === "__none__";

  const [allGoals, pillars, areas] = await Promise.all([
    getAllGoals({
      pillarId: params.pillarId || undefined,
      areaId: wantsNoArea ? undefined : params.areaId || undefined,
      status,
    }),
    getPillarOptions(),
    getAreaOptions(),
  ]);

  // Completed/Archived goals stay out of the default drilldown, same as
  // Archived habits — reachable, but only when explicitly filtered for.
  const statusFiltered = status ? allGoals : allGoals.filter((g) => g.status === "ACTIVE" || g.status === "PAUSED");
  const goals = wantsNoArea ? statusFiltered.filter((g) => !g.areaId) : statusFiltered;

  return (
    <>
      <PageHeader title="Goals" backHref="/today" />
      <div className={pageStyles.content}>
        <Suspense fallback={null}>
          <GoalsFilters pillars={pillars} areas={areas} />
        </Suspense>
        <Card>
          <GoalManager
            key={`${params.pillarId ?? ""}:${params.areaId ?? ""}:${params.status ?? ""}`}
            goals={goals}
            pillars={pillars}
            areas={areas}
            emptyMessage="No goals match these filters yet."
          />
        </Card>
      </div>
    </>
  );
}

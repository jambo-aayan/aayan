import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import pageStyles from "@/components/page-header.module.css";
import { PageTitle } from "@/components/page-title";
import { BackLink } from "@/components/back-link";
import { Card } from "@/components/card";
import { EditableText } from "@/components/editable-text";
import { HabitsList } from "@/components/habits-list";
import { AreaTasks } from "@/components/tasks/area-tasks";
import { PainMobilityTracker } from "@/components/pain-mobility-tracker";
import { CorrelationView } from "@/components/correlation-view";
import { DailyMetricHistory } from "@/components/daily-metric-history";
import { SystemsList } from "@/components/systems-list";
import { getArea } from "@/lib/areas/data";
import { getSystemsForArea, getHabitOptionsForPillar } from "@/lib/systems/data";
import { updateAreaCurrentState, updateAreaNorthStar } from "@/lib/areas/actions";
import { getHabitsForArea } from "@/lib/habits/data";
import { getTasksForArea, getTaskLists, getPillarOptions, getAreaOptions, getTaskTags } from "@/lib/tasks/data";
import { getGoalOptions } from "@/lib/goals/data";
import { getPainMobilityLogs } from "@/lib/pain-mobility/data";
import { PAIN_MOBILITY_AREA_ID } from "@/lib/pain-mobility/scope";
import { getDailyLogs } from "@/lib/daily-log/data";
import { SLEEP_AREA_ID, CARE_AREA_ID } from "@/lib/health/seed-data";
import { pillarHref } from "@/lib/pillars/nav";
import { resolveColorHex, type ColorKey } from "@/lib/colors";
import type { StiffnessBucket } from "@/lib/daily-log/logic";
import type { PageSection } from "@/lib/pillar-page/sections";
import styles from "./area-detail.module.css";

const STIFFNESS_LABELS: Record<StiffnessBucket, string> = {
  UNDER_15: "Under 15 min",
  "15_TO_30": "15–30 min",
  "30_TO_60": "30–60 min",
  OVER_60: "Over an hour",
};

/** Generic Area page (#157/ADR-0016) — every Area, seeded or user-created,
 * gets this same page under its Pillar's /[pillarId]/[areaId] route,
 * retrofitted off the original Health-only implementation. The three
 * bespoke, non-section cards below (Pain & Mobility, Sleep quality, Blood
 * pressure) stay hardcoded to their specific Health Areas, unchanged in
 * behavior — not generalized into anything any Area can add (per ADR-0016's
 * explicit "no generic score-tracking primitive"). */
export default async function AreaPage({
  params,
  searchParams,
}: {
  params: Promise<{ pillarId: string; areaId: string }>;
  searchParams: Promise<{ focus?: string }>;
}) {
  const { pillarId, areaId } = await params;
  const { focus } = await searchParams;
  const area = await getArea(areaId);
  if (!area || area.pillarId !== pillarId) notFound();

  const [habits, tasks, lists, pillars, areas, goals, tags, systems, systemHabitOptions] = await Promise.all([
    getHabitsForArea(areaId),
    getTasksForArea(areaId),
    getTaskLists(),
    getPillarOptions(),
    getAreaOptions(),
    getGoalOptions(area.pillarId),
    getTaskTags(),
    getSystemsForArea(areaId),
    getHabitOptionsForPillar(area.pillarId),
  ]);
  const isPainMobilityArea = areaId === PAIN_MOBILITY_AREA_ID;
  const isSleepArea = areaId === SLEEP_AREA_ID;
  const isCareArea = areaId === CARE_AREA_ID;
  const painLogs = isPainMobilityArea ? await getPainMobilityLogs(areaId) : [];
  // Raw daily-log-sheet values only, per docs/adr/0007-v2-phase3-daily-log-sheet.md
  // — new correlation cards reading DailyLog are Phase 6, not this page.
  const dailyLogs = isPainMobilityArea || isSleepArea || isCareArea ? await getDailyLogs() : [];
  const pillarHrefValue = pillarHref(area.pillarId);
  const pillar = pillars.find((p) => p.id === area.pillarId);
  const accentColor = resolveColorHex(pillar?.color as ColorKey | null);

  // Rendered from a list of section components (#157/ADR-0016), even
  // though visibility/ordering isn't user-configurable until #160. Current
  // state isn't one of the six section types — it's fixed content, sharing
  // a two-column grid with the North Star section for the existing visual
  // layout. The bespoke Health-only cards below (Pain & Mobility, Sleep
  // quality, Blood pressure) are fixed content too, not sections — see
  // ADR-0016's "no generic score-tracking primitive". Goals/Thoughts
  // sections land in #158.
  const sections: PageSection[] = [
    {
      type: "northStar",
      node: (
        <Card key="northStar">
          <EditableText
            label="North Star"
            initialValue={area.northStar}
            placeholder="No North Star set yet"
            fraunces={16}
            onSave={updateAreaNorthStar.bind(null, area.pillarId, area.id)}
          />
        </Card>
      ),
    },
    {
      type: "habits",
      node: (
        <Card key="habits" title="Habits">
          <HabitsList areaId={area.id} pillarId={area.pillarId} initialHabits={habits} pillarColor={accentColor} />
        </Card>
      ),
    },
    {
      type: "tasks",
      node: (
        <Card key="tasks" title="Tasks">
          <AreaTasks
            areaId={area.id}
            pillarId={area.pillarId}
            initialTasks={tasks}
            lists={lists}
            pillars={pillars}
            areas={areas}
            goals={goals}
            tagSuggestions={tags.map((t) => t.name)}
          />
        </Card>
      ),
    },
    {
      type: "systems",
      node: (
        <Card key="systems" title="Systems">
          <SystemsList
            areaId={area.id}
            pillarId={area.pillarId}
            initialSystems={systems}
            habitOptions={systemHabitOptions}
            goalOptions={goals}
            focusId={focus ?? null}
          />
        </Card>
      ),
    },
  ];
  const northStarSection = sections.find((s) => s.type === "northStar")!;
  const otherSections = sections.filter((s) => s.type !== "northStar");

  return (
    <>
      <PageHeader backHref={pillarHrefValue} accentColor={accentColor} />
      <div className={pageStyles.content}>
        <BackLink href={pillarHrefValue} label={pillar?.name ?? "Back"} />
        <PageTitle eyebrow="Area" title={area.name} />

        <div className={styles.fieldsGrid}>
          <Card>
            <EditableText
              label="Current state"
              initialValue={area.currentState}
              placeholder="No current state set yet"
              onSave={updateAreaCurrentState.bind(null, area.pillarId, area.id)}
            />
          </Card>
          {northStarSection.node}
        </div>

        {otherSections.map((s) => s.node)}
        {isPainMobilityArea && (
          <>
            <Card title="Pain & Mobility">
              <PainMobilityTracker areaId={area.id} initialLogs={painLogs} />
            </Card>
            <Card title="Correlation with habits">
              <CorrelationView
                habits={habits.filter((h) => h.status === "ACTIVE")}
                painLogs={painLogs.map((l) => ({ date: l.date, pain: l.pain }))}
              />
            </Card>
            <Card title="Pain (daily log)">
              <DailyMetricHistory
                entries={dailyLogs.map((l) => ({ date: l.date, label: `Pain ${l.pain}` }))}
                emptyMessage="No daily log entries yet."
              />
            </Card>
            <Card title="Morning stiffness (daily log)">
              <DailyMetricHistory
                entries={dailyLogs
                  .filter((l) => l.stiffnessBucket !== null)
                  .map((l) => ({ date: l.date, label: STIFFNESS_LABELS[l.stiffnessBucket!] }))}
                emptyMessage="No daily log entries yet."
              />
            </Card>
          </>
        )}
        {isSleepArea && (
          <Card title="Sleep quality (daily log)">
            <DailyMetricHistory
              entries={dailyLogs.map((l) => ({ date: l.date, label: `Sleep quality ${l.sleepQuality}` }))}
              emptyMessage="No daily log entries yet."
            />
          </Card>
        )}
        {isCareArea && (
          <Card title="Blood pressure (daily log)">
            <DailyMetricHistory
              entries={dailyLogs
                .filter((l) => l.bpSystolic !== null && l.bpDiastolic !== null)
                .map((l) => ({ date: l.date, label: `${l.bpSystolic}/${l.bpDiastolic}` }))}
              emptyMessage="No blood pressure readings logged yet."
            />
          </Card>
        )}
      </div>
    </>
  );
}

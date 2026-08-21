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
import { getArea } from "@/lib/health/data";
import { updateAreaCurrentState, updateAreaNorthStar } from "@/lib/health/actions";
import { getHabitsForArea } from "@/lib/habits/data";
import { getTasksForArea, getTaskLists, getPillarOptions, getAreaOptions, getTaskTags } from "@/lib/tasks/data";
import { getGoalOptions } from "@/lib/goals/data";
import { getPainMobilityLogs } from "@/lib/pain-mobility/data";
import { PAIN_MOBILITY_AREA_ID } from "@/lib/pain-mobility/scope";
import { resolveColorHex, type ColorKey } from "@/lib/colors";
import styles from "./area-detail.module.css";

export default async function AreaPage({
  params,
}: {
  params: Promise<{ areaId: string }>;
}) {
  const { areaId } = await params;
  const area = await getArea(areaId);
  if (!area) notFound();

  const [habits, tasks, lists, pillars, areas, goals, tags] = await Promise.all([
    getHabitsForArea(areaId),
    getTasksForArea(areaId),
    getTaskLists(),
    getPillarOptions(),
    getAreaOptions(),
    getGoalOptions(area.pillarId),
    getTaskTags(),
  ]);
  const isPainMobilityArea = areaId === PAIN_MOBILITY_AREA_ID;
  const painLogs = isPainMobilityArea ? await getPainMobilityLogs(areaId) : [];
  const accentColor = resolveColorHex(pillars.find((p) => p.id === area.pillarId)?.color as ColorKey | null);

  return (
    <>
      <PageHeader backHref="/health" accentColor={accentColor} />
      <div className={pageStyles.content}>
        <BackLink href="/health" label="Health" />
        <PageTitle eyebrow="Area" title={area.name} />

        <div className={styles.fieldsGrid}>
          <Card>
            <EditableText
              label="Current state"
              initialValue={area.currentState}
              placeholder="No current state set yet"
              onSave={updateAreaCurrentState.bind(null, area.id)}
            />
          </Card>
          <Card>
            <EditableText
              label="North Star"
              initialValue={area.northStar}
              placeholder="No North Star set yet"
              fraunces={16}
              onSave={updateAreaNorthStar.bind(null, area.id)}
            />
          </Card>
        </div>

        <Card title="Habits">
          <HabitsList areaId={area.id} pillarId={area.pillarId} initialHabits={habits} pillarColor={accentColor} />
        </Card>
        <Card title="Tasks">
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
          </>
        )}
      </div>
    </>
  );
}

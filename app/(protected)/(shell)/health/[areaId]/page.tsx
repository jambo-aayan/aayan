import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import pageStyles from "@/components/page-header.module.css";
import { Card } from "@/components/card";
import { EditableText } from "@/components/editable-text";
import { HabitsList } from "@/components/habits-list";
import { ActionGoalsList } from "@/components/action-goals-list";
import { getArea } from "@/lib/health/data";
import { updateAreaCurrentState, updateAreaNorthStar } from "@/lib/health/actions";
import { getHabitsForArea } from "@/lib/habits/data";
import { getActionGoalsForArea } from "@/lib/action-goals/data";

export default async function AreaPage({
  params,
}: {
  params: Promise<{ areaId: string }>;
}) {
  const { areaId } = await params;
  const area = await getArea(areaId);
  if (!area) notFound();

  const [habits, goals] = await Promise.all([getHabitsForArea(areaId), getActionGoalsForArea(areaId)]);

  return (
    <>
      <PageHeader title={area.name} backHref="/health" />
      <div className={pageStyles.content}>
        <Card>
          <EditableText
            label="Current state"
            initialValue={area.currentState}
            placeholder="No current state set yet"
            onSave={updateAreaCurrentState.bind(null, area.id)}
          />
          <EditableText
            label="North Star"
            initialValue={area.northStar}
            placeholder="No North Star set yet"
            onSave={updateAreaNorthStar.bind(null, area.id)}
          />
        </Card>
        <Card title="Habits">
          <HabitsList areaId={area.id} initialHabits={habits} />
        </Card>
        <Card title="Goals">
          <ActionGoalsList areaId={area.id} initialGoals={goals} />
        </Card>
      </div>
    </>
  );
}

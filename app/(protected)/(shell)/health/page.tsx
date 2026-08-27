import { PageHeader } from "@/components/page-header";
import pageStyles from "@/components/page-header.module.css";
import { PageTitle } from "@/components/page-title";
import { Card } from "@/components/card";
import { HealthMindmap } from "@/components/health-mindmap";
import { EditableText } from "@/components/editable-text";
import { SystemsList } from "@/components/systems-list";
import { getHealthPillarWithAreas } from "@/lib/health/data";
import { updateHealthPillarNorthStar } from "@/lib/health/actions";
import { getSystemsForPillar, getHabitOptionsForPillar } from "@/lib/systems/data";
import { getGoalOptions } from "@/lib/goals/data";
import { HEALTH_PILLAR_ID } from "@/lib/health/seed-data";
import { resolveColorHex, type ColorKey } from "@/lib/colors";

export default async function HealthPage({ searchParams }: { searchParams: Promise<{ focus?: string }> }) {
  const { focus } = await searchParams;
  const [pillar, systems, habitOptions, goalOptions] = await Promise.all([
    getHealthPillarWithAreas(),
    getSystemsForPillar(HEALTH_PILLAR_ID),
    getHabitOptionsForPillar(HEALTH_PILLAR_ID),
    getGoalOptions(HEALTH_PILLAR_ID),
  ]);
  const accentColor = resolveColorHex(pillar.color as ColorKey | null);

  return (
    <>
      <PageHeader accentColor={accentColor} />
      <div className={pageStyles.content}>
        <PageTitle eyebrow="Pillar" title="Health" lede="Seven areas, one body. Tap a node to go into it." />
        <Card>
          <HealthMindmap areas={pillar.areas} accentColor={accentColor} />
        </Card>
        <Card title="North Star">
          <EditableText
            label="Health"
            initialValue={pillar.northStar}
            placeholder="No North Star set yet"
            hint="Click to edit · saves as you type"
            fraunces={19}
            onSave={updateHealthPillarNorthStar}
          />
        </Card>
        <Card title="Systems">
          <SystemsList
            areaId={null}
            pillarId={HEALTH_PILLAR_ID}
            initialSystems={systems}
            habitOptions={habitOptions}
            goalOptions={goalOptions}
            focusId={focus ?? null}
          />
        </Card>
      </div>
    </>
  );
}

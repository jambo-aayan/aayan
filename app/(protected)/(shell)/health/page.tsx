import { PageHeader } from "@/components/page-header";
import pageStyles from "@/components/page-header.module.css";
import { Card } from "@/components/card";
import { HealthMindmap } from "@/components/health-mindmap";
import { EditableText } from "@/components/editable-text";
import { getHealthPillarWithAreas } from "@/lib/health/data";
import { updateHealthPillarNorthStar } from "@/lib/health/actions";
import { resolveColorHex, type ColorKey } from "@/lib/colors";

export default async function HealthPage() {
  const pillar = await getHealthPillarWithAreas();
  const accentColor = resolveColorHex(pillar.color as ColorKey | null);

  return (
    <>
      <PageHeader title="Health" accentColor={accentColor} />
      <div className={pageStyles.content}>
        <Card title="Areas">
          <HealthMindmap areas={pillar.areas} accentColor={accentColor} />
        </Card>
        <Card title="North Star">
          <EditableText
            label="Health"
            initialValue={pillar.northStar}
            placeholder="No North Star set yet"
            onSave={updateHealthPillarNorthStar}
          />
        </Card>
      </div>
    </>
  );
}

import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import pageStyles from "@/components/page-header.module.css";
import { Card } from "@/components/card";
import { EditableText } from "@/components/editable-text";
import { getArea } from "@/lib/health/data";
import { updateAreaCurrentState, updateAreaNorthStar } from "@/lib/health/actions";

export default async function AreaPage({
  params,
}: {
  params: Promise<{ areaId: string }>;
}) {
  const { areaId } = await params;
  const area = await getArea(areaId);
  if (!area) notFound();

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
      </div>
    </>
  );
}

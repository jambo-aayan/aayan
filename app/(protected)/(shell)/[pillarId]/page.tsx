import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import pageStyles from "@/components/page-header.module.css";
import { PageTitle } from "@/components/page-title";
import { Layers } from "lucide-react";
import { Card } from "@/components/card";
import { PillarMindmap } from "@/components/pillar-mindmap";
import { NewAreaTile } from "@/components/new-area-tile";
import { EmptyState } from "@/components/empty-state";
import { EditableText } from "@/components/editable-text";
import { SystemsList } from "@/components/systems-list";
import { getPillarWithAreas } from "@/lib/pillars/data";
import { updatePillarNorthStar } from "@/lib/pillars/actions";
import { getSystemsForPillar, getHabitOptionsForPillar } from "@/lib/systems/data";
import { getGoalOptions, getGoalsForPillar } from "@/lib/goals/data";
import { getThoughtsForPillar } from "@/lib/thoughts/data";
import { PillarAreaGoals } from "@/components/goals/pillar-area-goals";
import { PillarAreaThoughts } from "@/components/thoughts/pillar-area-thoughts";
import { ChartZone } from "@/components/visuals/chart-zone";
import { TableZone } from "@/components/visuals/table-zone";
import { getVisualsForPillar } from "@/lib/visuals/data";
import { FINANCE_PILLAR_ID } from "@/lib/finance/pillar-id";
import { resolveColorHex, type ColorKey } from "@/lib/colors";
import { resolveSectionOrder, type PageSection, type SectionConfigEntry } from "@/lib/pillar-page/sections";
import { SectionManager } from "@/components/pillar-page/section-manager";

/** Generic Pillar page (#157/ADR-0016) — every Pillar, seeded or
 * user-created, gets this same page, retrofitted off the original
 * Health-only implementation. Finances keeps its own bespoke literal
 * /finances route (see app/(protected)/(shell)/finances/page.tsx) — this
 * dynamic route never resolves for it, since pillarHref sends Finances'
 * nav entry there instead, but the guard below is cheap insurance against
 * a stray direct /finance visit. */
export default async function PillarPage({
  params,
  searchParams,
}: {
  params: Promise<{ pillarId: string }>;
  searchParams: Promise<{ focus?: string }>;
}) {
  const { pillarId } = await params;
  if (pillarId === FINANCE_PILLAR_ID) notFound();

  const { focus } = await searchParams;
  const pillar = await getPillarWithAreas(pillarId);
  if (!pillar) notFound();

  const [systems, habitOptions, goalOptions, pillarGoals, thoughts, visuals] = await Promise.all([
    getSystemsForPillar(pillarId),
    getHabitOptionsForPillar(pillarId),
    getGoalOptions(pillarId),
    getGoalsForPillar(pillarId),
    getThoughtsForPillar(pillarId),
    getVisualsForPillar(pillarId),
  ]);
  const chartVisuals = visuals.filter((v) => v.type !== "TABLE");
  const tableVisuals = visuals.filter((v) => v.type === "TABLE");
  const accentColor = resolveColorHex(pillar.color as ColorKey | null);

  // Built as a list of section components (#157/ADR-0016); resolveSectionOrder
  // (#160) applies the stored order/visibility on top before rendering. The
  // mindmap overview isn't in this list, it's fixed content shown above it
  // whenever the Pillar has Areas, per ADR-0016's "a page can carry fixed,
  // non-section content" note.
  const sections: PageSection[] = [
    {
      type: "northStar",
      node: (
        <Card key="northStar" title="North Star">
          <EditableText
            label={pillar.name}
            initialValue={pillar.northStar}
            placeholder="No North Star set yet"
            hint="Click to edit · saves as you type"
            fraunces={19}
            onSave={updatePillarNorthStar.bind(null, pillar.id)}
          />
        </Card>
      ),
    },
    {
      type: "goals",
      node: (
        <Card key="goals" title="Goals">
          <PillarAreaGoals pillarId={pillar.id} areaId={null} initialGoals={pillarGoals} />
        </Card>
      ),
    },
    {
      type: "systems",
      node: (
        <Card key="systems" title="Systems">
          <SystemsList
            areaId={null}
            pillarId={pillar.id}
            initialSystems={systems}
            habitOptions={habitOptions}
            goalOptions={goalOptions}
            focusId={focus ?? null}
          />
        </Card>
      ),
    },
    {
      type: "thoughts",
      node: (
        <Card key="thoughts" title="Thoughts">
          <PillarAreaThoughts pillarId={pillar.id} areaId={null} initialThoughts={thoughts} />
        </Card>
      ),
    },
    {
      type: "charts",
      node: (
        <Card key="charts" title="Charts">
          <ChartZone visuals={chartVisuals} pillarId={pillar.id} areaId={null} />
        </Card>
      ),
    },
    {
      type: "table",
      node: (
        <Card key="table" title="Table">
          <TableZone visuals={tableVisuals} pillarId={pillar.id} areaId={null} />
        </Card>
      ),
    },
  ];
  const resolvedOrder = resolveSectionOrder(
    sections.map((s) => s.type),
    pillar.sectionConfig as SectionConfigEntry[] | null
  );
  const sectionByType = new Map(sections.map((s) => [s.type, s.node]));

  return (
    <>
      <PageHeader accentColor={accentColor} />
      <div className={pageStyles.content}>
        <PageTitle
          eyebrow="Pillar"
          title={pillar.name}
          lede={pillar.areas.length > 0 ? "Tap an area to go into it." : undefined}
        />
        <SectionManager pillarId={pillar.id} areaId={null} initialConfig={resolvedOrder} />
        <Card title={pillar.areas.length === 0 ? "Areas" : undefined}>
          {pillar.areas.length > 0 ? (
            <PillarMindmap pillarId={pillar.id} pillarName={pillar.name} areas={pillar.areas} accentColor={accentColor} />
          ) : (
            <EmptyState icon={Layers} message="No areas yet." />
          )}
          <NewAreaTile pillarId={pillar.id} />
        </Card>
        {resolvedOrder.filter((e) => e.visible).map((e) => sectionByType.get(e.type))}
      </div>
    </>
  );
}

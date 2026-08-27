import { PageHeader } from "@/components/page-header";
import pageStyles from "@/components/page-header.module.css";
import { PageTitle } from "@/components/page-title";
import { Card } from "@/components/card";
import { TodaySectionPills } from "@/components/nav-pills";
import { SystemsTab } from "@/components/systems-tab";
import { getSystemsOverview } from "@/lib/systems/data";
import { getPillarOptions, getAreaOptions } from "@/lib/tasks/data";

export default async function SystemsPage() {
  const today = new Date();
  const [overview, pillars, areas] = await Promise.all([getSystemsOverview(today), getPillarOptions(), getAreaOptions()]);

  return (
    <>
      <PageHeader backHref="/today" />
      <div className={pageStyles.content}>
        <PageTitle
          eyebrow="Cross-cutting"
          title="Systems"
          lede="Every Process and Experiment you're running, in one place."
        />
        <Card>
          <SystemsTab
            areaLoad={overview.areaLoad}
            loadSummary={overview.loadSummary}
            timeline={overview.timeline}
            rollup={overview.rollup}
            whatWorked={overview.whatWorked}
            pillars={pillars}
            areas={areas}
            today={today}
          />
        </Card>
        <TodaySectionPills />
      </div>
    </>
  );
}

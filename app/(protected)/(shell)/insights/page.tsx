import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import pageStyles from "@/components/page-header.module.css";
import { PageTitle } from "@/components/page-title";
import { RangeControl } from "@/components/insights/range-control";
import { MomentumCard } from "@/components/insights/momentum-card";
import { KpiCard } from "@/components/insights/kpi-card";
import { getMomentumSummary, getKpiSummary } from "@/lib/insights/data";
import { parseInsightsRange } from "@/lib/insights/range";
import styles from "./insights.module.css";

export default async function InsightsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string | string[] }>;
}) {
  const range = parseInsightsRange((await searchParams).range);
  // Momentum ignores `range` by design (fixed rolling 28 days) — every KPI
  // below does respond to it, per the Insights header's own instruction.
  const [momentum, kpis] = await Promise.all([getMomentumSummary(), getKpiSummary(range)]);

  return (
    <>
      <PageHeader backHref="/today" />
      <div className={pageStyles.content}>
        <div className={styles.head}>
          <PageTitle
            eyebrow="Analytics"
            title="Insights"
            lede="Performance across every pillar, in plain language first and numbers second."
          />
          <div className={styles.controls}>
            <RangeControl value={range} />
            <Link href="/weekly-review" className={styles.exportLink}>
              Export weekly review →
            </Link>
          </div>
        </div>

        <MomentumCard momentum={momentum} />

        <div className={styles.kpiGrid}>
          <KpiCard label="Habit adherence" unit="%" kpi={kpis.adherence} />
          <KpiCard label="Task follow-through" unit="%" kpi={kpis.followThrough} />
          <KpiCard label="Goal velocity" unit="%" kpi={kpis.goalVelocity} />
          <KpiCard label="Surplus rate" unit="%" kpi={kpis.surplusRate} />
        </div>
      </div>
    </>
  );
}

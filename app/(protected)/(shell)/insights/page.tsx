import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import pageStyles from "@/components/page-header.module.css";
import { PageTitle } from "@/components/page-title";
import { RangeControl } from "@/components/insights/range-control";
import { MomentumCard } from "@/components/insights/momentum-card";
import { KpiCard } from "@/components/insights/kpi-card";
import { ConsistencyGrid } from "@/components/insights/consistency-grid";
import { NeglectRadar } from "@/components/insights/neglect-radar";
import { getMomentumSummary, getKpiSummary, getConsistencyGridSummary, getNeglectRadar } from "@/lib/insights/data";
import { parseInsightsRange } from "@/lib/insights/range";
import styles from "./insights.module.css";

export default async function InsightsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string | string[] }>;
}) {
  const range = parseInsightsRange((await searchParams).range);
  // Momentum and the Neglect radar both ignore `range` by design — Momentum
  // is a fixed rolling 28 days, and "days since activity" is inherently
  // as-of-now, not something a lookback window redefines. Every KPI and
  // the Consistency grid do respond to it.
  const [momentum, kpis, consistencyGrid, neglectRows] = await Promise.all([
    getMomentumSummary(),
    getKpiSummary(range),
    getConsistencyGridSummary(range),
    getNeglectRadar(),
  ]);

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

        <div className={styles.section}>
          <ConsistencyGrid grid={consistencyGrid} />
        </div>

        <div className={styles.section}>
          <NeglectRadar rows={neglectRows} />
        </div>
      </div>
    </>
  );
}

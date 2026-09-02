import { PageHeader } from "@/components/page-header";
import pageStyles from "@/components/page-header.module.css";
import { PageTitle } from "@/components/page-title";
import { LogTab } from "@/components/log/log-tab";
import { getMetricsForLog, getMetricScopeOptions } from "@/lib/metrics/data";

export default async function LogPage() {
  const [metrics, scope] = await Promise.all([getMetricsForLog(), getMetricScopeOptions()]);

  return (
    <>
      <PageHeader backHref="/today" />
      <div className={pageStyles.content}>
        <PageTitle eyebrow="Log" title="Log" lede="Everything due today or this week, in one place." />
        <LogTab metrics={metrics} pillars={scope.pillars} areas={scope.areas} />
      </div>
    </>
  );
}

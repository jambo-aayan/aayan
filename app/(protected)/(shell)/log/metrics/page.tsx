import { PageHeader } from "@/components/page-header";
import pageStyles from "@/components/page-header.module.css";
import { PageTitle } from "@/components/page-title";
import { Card } from "@/components/card";
import { MetricManager } from "@/components/metrics/metric-manager";
import { getMetrics, getMetricScopeOptions } from "@/lib/metrics/data";

export default async function MetricsPage() {
  const [metrics, scope] = await Promise.all([getMetrics(), getMetricScopeOptions()]);

  return (
    <>
      <PageHeader title="Metrics" backHref="/log" />
      <div className={pageStyles.content}>
        <PageTitle
          eyebrow="Log"
          title="Metrics"
          lede="What you track, how often, and whether it's required — required metrics you miss show up as a nudge."
        />
        <Card>
          <MetricManager metrics={metrics} pillars={scope.pillars} areas={scope.areas} />
        </Card>
      </div>
    </>
  );
}

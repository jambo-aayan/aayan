import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import pageStyles from "@/components/page-header.module.css";
import { PageTitle } from "@/components/page-title";
import { Card } from "@/components/card";
import { MetricHistoryView } from "@/components/log/metric-history-view";
import { getMetric, getMetricEntries } from "@/lib/metrics/data";

const CADENCE_LABELS: Record<string, string> = { DAILY: "Daily", WEEKLY: "Weekly", AD_HOC: "Ad hoc" };

export default async function MetricHistoryPage({ params }: { params: Promise<{ metricId: string }> }) {
  const { metricId } = await params;
  const [metric, entries] = await Promise.all([getMetric(metricId), getMetricEntries(metricId)]);
  if (!metric) notFound();

  return (
    <>
      <PageHeader title={metric.name} backHref="/log" />
      <div className={pageStyles.content}>
        <PageTitle eyebrow={CADENCE_LABELS[metric.cadence] ?? metric.cadence} title={metric.name} />
        <Card>
          <MetricHistoryView entries={entries} valueType={metric.valueType} unit={metric.unit} />
        </Card>
      </div>
    </>
  );
}

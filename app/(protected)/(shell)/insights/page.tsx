import { PageHeader } from "@/components/page-header";
import pageStyles from "@/components/page-header.module.css";
import { Card } from "@/components/card";

/** Stub landing page — the Insights nav item needs somewhere real to point
 * per #54's spec, but the actual Momentum/KPI/Consistency/etc. modules are
 * their own tickets (#68 onward). */
export default function InsightsPage() {
  return (
    <>
      <PageHeader title="Insights" backHref="/today" />
      <div className={pageStyles.content}>
        <Card title="Coming soon">
          <p>Momentum, KPIs, and the rest of Insights land in their own tickets.</p>
        </Card>
      </div>
    </>
  );
}

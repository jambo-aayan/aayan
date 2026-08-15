import { PageHeader } from "@/components/page-header";
import pageStyles from "@/components/page-header.module.css";
import { Card } from "@/components/card";
import { NetWorthStats } from "@/components/net-worth-stats";
import { BaselineForm } from "@/components/baseline-form";
import { ItemsManager } from "@/components/items-manager";
import { getItems, getBaseline } from "@/lib/finance/data";

export default async function FinancesPage() {
  const [items, baseline] = await Promise.all([getItems(), getBaseline()]);

  return (
    <>
      <PageHeader title="Finances" />
      <div className={pageStyles.content}>
        <NetWorthStats items={items} />
        <Card title="Baseline">
          <BaselineForm
            initialIncome={baseline.monthlyIncome}
            initialOutgoings={baseline.fixedOutgoings}
          />
        </Card>
        <Card title="Items">
          <ItemsManager initialItems={items} />
        </Card>
      </div>
    </>
  );
}

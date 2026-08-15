import { PageHeader } from "@/components/page-header";
import pageStyles from "@/components/page-header.module.css";
import { Card } from "@/components/card";
import { NetWorthStats } from "@/components/net-worth-stats";
import { BaselineForm } from "@/components/baseline-form";
import { ItemsManager } from "@/components/items-manager";
import { GoalsManager } from "@/components/goals-manager";
import { FinanceNorthStarCard } from "@/components/finance-north-star-card";
import { TransactionsManager } from "@/components/transactions-manager";
import { CategoryBreakdownView } from "@/components/category-breakdown-view";
import {
  getItems,
  getBaseline,
  getGoals,
  getFinanceNorthStar,
  getTransactions,
} from "@/lib/finance/data";
import { netWorth } from "@/lib/finance/net-worth";
import { surplus } from "@/lib/finance/baseline-math";
import { categoryBreakdown } from "@/lib/finance/category-breakdown";

export default async function FinancesPage() {
  const [items, baseline, goals, financeNorthStar, transactions] = await Promise.all([
    getItems(),
    getBaseline(),
    getGoals(),
    getFinanceNorthStar(),
    getTransactions(),
  ]);
  const { accessible } = netWorth(items);
  const monthlySurplus = surplus(baseline.monthlyIncome, baseline.fixedOutgoings);
  const breakdown = categoryBreakdown(transactions, new Date());

  return (
    <>
      <PageHeader title="Finances" />
      <div className={pageStyles.content}>
        <NetWorthStats items={items} />
        <Card title="North Star">
          <FinanceNorthStarCard
            initialTarget={financeNorthStar.target}
            initialDeadline={financeNorthStar.deadline}
            accessibleNetWorth={accessible}
            actualMonthlyRate={monthlySurplus}
          />
        </Card>
        <Card title="Baseline">
          <BaselineForm
            initialIncome={baseline.monthlyIncome}
            initialOutgoings={baseline.fixedOutgoings}
          />
        </Card>
        <Card title="Goals">
          <GoalsManager initialGoals={goals} surplus={monthlySurplus} />
        </Card>
        <Card title="This month by category">
          <CategoryBreakdownView breakdown={breakdown} />
        </Card>
        <Card title="Transactions">
          <TransactionsManager initialTransactions={transactions} />
        </Card>
        <Card title="Items">
          <ItemsManager initialItems={items} />
        </Card>
      </div>
    </>
  );
}

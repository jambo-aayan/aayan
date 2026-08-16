import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import pageStyles from "@/components/page-header.module.css";
import { Card } from "@/components/card";
import { BaselineForm } from "@/components/baseline-form";
import { ItemsManager } from "@/components/items-manager";
import { GoalsManager } from "@/components/goals-manager";
import { FinanceNorthStarCard } from "@/components/finance-north-star-card";
import { TransactionsManager } from "@/components/transactions-manager";
import { CategoryBreakdownView } from "@/components/category-breakdown-view";
import { StatRow } from "@/components/finance-dashboard/stat-row";
import { TrendChart } from "@/components/finance-dashboard/trend-chart";
import { NorthStarRingCard } from "@/components/finance-dashboard/north-star-ring-card";
import { GoalRingsCard } from "@/components/finance-dashboard/goal-rings-card";
import { BreakdownRingCard } from "@/components/finance-dashboard/breakdown-ring-card";
import { ActivityTable } from "@/components/finance-dashboard/activity-table";
import dashboardStyles from "@/components/finance-dashboard/dashboard.module.css";
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
import { goalProgressPercent } from "@/lib/finance/goal-math";
import { cashFlowTrend } from "@/lib/finance/cash-flow-trend";
import { netWorthBreakdown } from "@/lib/finance/net-worth-breakdown";

export default async function FinancesPage() {
  const [items, baseline, goals, financeNorthStar, transactions] = await Promise.all([
    getItems(),
    getBaseline(),
    getGoals(),
    getFinanceNorthStar(),
    getTransactions(),
  ]);
  const { accessible, total } = netWorth(items);
  const monthlySurplus = surplus(baseline.monthlyIncome, baseline.fixedOutgoings);
  const categorySpending = categoryBreakdown(transactions, new Date());
  const northStarPercent = financeNorthStar.target !== null ? goalProgressPercent(accessible, financeNorthStar.target) : null;
  const trendPoints = cashFlowTrend(transactions);
  const assetBreakdown = netWorthBreakdown(items);

  return (
    <>
      <PageHeader title="Finances" />
      <div className={pageStyles.content}>
        <StatRow accessible={accessible} total={total} surplus={monthlySurplus} northStarPercent={northStarPercent} />

        <div className={dashboardStyles.dashGrid}>
          <TrendChart points={trendPoints} />
          <NorthStarRingCard percent={northStarPercent} hasTarget={financeNorthStar.target !== null} />
          <GoalRingsCard goals={goals} />
          <BreakdownRingCard breakdown={assetBreakdown} accessible={accessible} />
          <ActivityTable transactions={transactions} />
        </div>

        <div className={dashboardStyles.divider}>Manage</div>

        <Card>
          <Link href="/finances/link-bank">Link a bank →</Link>
        </Card>

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
          <CategoryBreakdownView breakdown={categorySpending} />
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

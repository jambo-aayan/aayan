import { Landmark } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import pageStyles from "@/components/page-header.module.css";
import { PageTitle } from "@/components/page-title";
import { Card } from "@/components/card";
import { DashboardCard } from "@/components/dashboard-card";
import { BaselineForm } from "@/components/baseline-form";
import { AccountsManager } from "@/components/accounts-manager";
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
import { SystemsList } from "@/components/systems-list";
import dashboardStyles from "@/components/finance-dashboard/dashboard.module.css";
import {
  getAccounts,
  getBaseline,
  getGoals,
  getFinanceNorthStar,
  getTransactions,
} from "@/lib/finance/data";
import { getLinkedBanks } from "@/lib/enable-banking/data";
import { netWorth } from "@/lib/finance/net-worth";
import { surplus } from "@/lib/finance/baseline-math";
import { categoryBreakdown } from "@/lib/finance/category-breakdown";
import { goalProgressPercent } from "@/lib/finance/goal-math";
import { cashFlowTrend } from "@/lib/finance/cash-flow-trend";
import { netWorthBreakdown } from "@/lib/finance/net-worth-breakdown";
import { getSystemsForPillar, getHabitOptionsForPillar } from "@/lib/systems/data";
import { getGoalOptions as getGoalOptionsForPillar } from "@/lib/goals/data";
import { FINANCE_PILLAR_ID } from "@/lib/finance/pillar-id";

export default async function FinancesPage({ searchParams }: { searchParams: Promise<{ focus?: string }> }) {
  const { focus } = await searchParams;
  const [accounts, baseline, goals, financeNorthStar, transactions, linkedBanks, systems, systemHabitOptions, systemGoalOptions] =
    await Promise.all([
      getAccounts(),
      getBaseline(),
      getGoals(),
      getFinanceNorthStar(),
      getTransactions(),
      getLinkedBanks(),
      getSystemsForPillar(FINANCE_PILLAR_ID),
      getHabitOptionsForPillar(FINANCE_PILLAR_ID),
      getGoalOptionsForPillar(FINANCE_PILLAR_ID),
    ]);
  const { accessible, total } = netWorth(accounts);
  const monthlySurplus = surplus(baseline.monthlyIncome, baseline.fixedOutgoings);
  const categorySpending = categoryBreakdown(transactions, new Date());
  const northStarPercent = financeNorthStar.target !== null ? goalProgressPercent(accessible, financeNorthStar.target) : null;
  const trendPoints = cashFlowTrend(transactions);
  const assetBreakdown = netWorthBreakdown(accounts);

  return (
    <>
      <PageHeader />
      <div className={pageStyles.content}>
        <PageTitle eyebrow="Pillar" title="Finances" />
        <StatRow accessible={accessible} total={total} surplus={monthlySurplus} northStarPercent={northStarPercent} />

        <div className={dashboardStyles.dashGrid}>
          <TrendChart points={trendPoints} />
          <NorthStarRingCard percent={northStarPercent} hasTarget={financeNorthStar.target !== null} />
          <GoalRingsCard goals={goals} />
          <BreakdownRingCard breakdown={assetBreakdown} accessible={accessible} />
          <ActivityTable transactions={transactions} />
        </div>

        <div className={dashboardStyles.divider}>Manage</div>

        <DashboardCard
          href="/finances/link-bank"
          icon={Landmark}
          accent="finance"
          title="Link a bank"
          status={linkedBanks.length === 0 ? "None linked yet" : `${linkedBanks.length} linked`}
        />

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
        <Card title="Accounts">
          <AccountsManager initialAccounts={accounts} />
        </Card>
        <Card title="Systems">
          <SystemsList
            areaId={null}
            pillarId={FINANCE_PILLAR_ID}
            initialSystems={systems}
            habitOptions={systemHabitOptions}
            goalOptions={systemGoalOptions}
            focusId={focus ?? null}
          />
        </Card>
      </div>
    </>
  );
}

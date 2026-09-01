import { Landmark, ClipboardCheck, FileBarChart } from "lucide-react";
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
import { ReceivablesList } from "@/components/receivables-list";
import { CategoryBreakdownView } from "@/components/category-breakdown-view";
import { SpendDeviationView } from "@/components/spend-deviation-view";
import { CategoryTrendView } from "@/components/category-trend-view";
import { RecurringChargesView } from "@/components/recurring-charges-view";
import { StatRow } from "@/components/finance-dashboard/stat-row";
import { TrendChart } from "@/components/finance-dashboard/trend-chart";
import { NorthStarRingCard } from "@/components/finance-dashboard/north-star-ring-card";
import { GoalRingsCard } from "@/components/finance-dashboard/goal-rings-card";
import { BreakdownRingCard } from "@/components/finance-dashboard/breakdown-ring-card";
import { ActivityTable } from "@/components/finance-dashboard/activity-table";
import { SystemsList } from "@/components/systems-list";
import { GoalProgressRings, SurplusSplitCard } from "@/components/financial-plan-section";
import { FinanceSetupChecklist } from "@/components/finance-setup-checklist";
import { BudgetVsActual } from "@/components/budget-vs-actual";
import { TransferSuggestionsBanner } from "@/components/transfer-suggestions-banner";
import dashboardStyles from "@/components/finance-dashboard/dashboard.module.css";
import {
  getAccounts,
  getBaseline,
  getGoals,
  getFinanceNorthStar,
  getTransactions,
  getReceivables,
  getUncategorisedTransactions,
  getFinanceSetupStatus,
  getBudgets,
  getCategories,
} from "@/lib/finance/data";
import { getLinkedBanks } from "@/lib/enable-banking/data";
import { netWorth } from "@/lib/finance/net-worth";
import { surplus } from "@/lib/finance/baseline-math";
import { budgetVsActual, categoryBreakdown } from "@/lib/finance/category-breakdown";
import { categorySpendDeviation, totalSpendDeviation } from "@/lib/finance/spend-deviation";
import { categoryTimeSeries, detectRecurringCharges } from "@/lib/finance/statements";
import { goalProgressPercent } from "@/lib/finance/goal-math";
import { cashFlowTrend } from "@/lib/finance/cash-flow-trend";
import { netWorthBreakdown } from "@/lib/finance/net-worth-breakdown";
import { getSystemsForPillar, getHabitOptionsForPillar } from "@/lib/systems/data";
import { getGoalOptions as getGoalOptionsForPillar } from "@/lib/goals/data";
import { FINANCE_PILLAR_ID } from "@/lib/finance/pillar-id";
import { canReclassifyTransaction, findTransferSuggestions } from "@/lib/finance/logic";

const TREND_MONTHS = 6;
// The finances page's own quick-add/edit list shows only the most recent
// N — the full paginated/filterable browser (#150, ADR-0015) is the
// place for everything else, reached via the "See all" link below it.
const RECENT_TRANSACTIONS_LIMIT = 10;

/** The last `count` calendar months, oldest first, ending with `from`'s own
 * month — plain date arithmetic, not business logic, so it's inlined here
 * the same way the Statements page inlines its own copy. */
function lastMonths(from: Date, count: number): Date[] {
  return Array.from({ length: count }, (_, i) => new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() - (count - 1 - i), 1)));
}

export default async function FinancesPage({ searchParams }: { searchParams: Promise<{ focus?: string }> }) {
  const { focus } = await searchParams;
  const [
    accounts,
    baseline,
    goals,
    financeNorthStar,
    transactions,
    receivables,
    uncategorisedTransactions,
    linkedBanks,
    systems,
    systemHabitOptions,
    systemGoalOptions,
    setupStatus,
    budgets,
    categories,
  ] = await Promise.all([
    getAccounts(),
    getBaseline(),
    getGoals(),
    getFinanceNorthStar(),
    getTransactions(),
    getReceivables(),
    getUncategorisedTransactions(),
    getLinkedBanks(),
    getSystemsForPillar(FINANCE_PILLAR_ID),
    getHabitOptionsForPillar(FINANCE_PILLAR_ID),
    getGoalOptionsForPillar(FINANCE_PILLAR_ID),
    getFinanceSetupStatus(),
    getBudgets(),
    getCategories(),
  ]);
  const { accessible, total } = netWorth(accounts);
  const monthlySurplus = surplus(baseline.monthlyIncome, baseline.fixedOutgoings);
  const today = new Date();
  const currentMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const daysInMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0)).getUTCDate();
  const daysElapsed = today.getUTCDate();
  const categorySpending = categoryBreakdown(transactions, currentMonth);
  const spendDeviationCategories = categorySpendDeviation(transactions, currentMonth);
  const spendDeviationWhole = totalSpendDeviation(transactions, currentMonth);
  const trendMonths = lastMonths(currentMonth, TREND_MONTHS);
  const categoryTrend = categoryTimeSeries(transactions, trendMonths);
  const recurringCharges = detectRecurringCharges(transactions);
  const budgetStatuses = budgetVsActual(transactions, currentMonth, budgets, daysElapsed, daysInMonth);
  const northStarPercent = financeNorthStar.target !== null ? goalProgressPercent(accessible, financeNorthStar.target) : null;
  const trendPoints = cashFlowTrend(transactions);
  const assetBreakdown = netWorthBreakdown(accounts);
  const repaymentCandidates = transactions.filter((t) => t.direction === "IN" && t.receivableId === null);
  const contributionCandidates = transactions.filter(
    (t) => t.direction === "OUT" && t.receivableId === null && t.goalContributionId === null
  );
  const transferSuggestions = findTransferSuggestions(transactions.filter(canReclassifyTransaction));

  return (
    <>
      <PageHeader />
      <div className={pageStyles.content}>
        <PageTitle eyebrow="Pillar" title="Finances" />
        {!setupStatus.complete && <FinanceSetupChecklist steps={setupStatus.steps} />}
        <TransferSuggestionsBanner suggestions={transferSuggestions} />
        <StatRow accessible={accessible} total={total} surplus={monthlySurplus} northStarPercent={northStarPercent} />

        <div className={dashboardStyles.dashGrid}>
          <TrendChart points={trendPoints} />
          <NorthStarRingCard percent={northStarPercent} hasTarget={financeNorthStar.target !== null} />
          <GoalRingsCard goals={goals} />
          <BreakdownRingCard breakdown={assetBreakdown} accessible={accessible} />
          <ActivityTable transactions={transactions} />
        </div>

        <div id="financial-plan" className={dashboardStyles.divider}>Financial plan</div>

        <Card title="Goals progress">
          <GoalProgressRings goals={goals} />
        </Card>
        <Card title="Split your surplus">
          <SurplusSplitCard goals={goals} surplus={monthlySurplus} />
        </Card>

        <div className={dashboardStyles.divider}>Manage</div>

        <DashboardCard
          href="/finances/link-bank"
          icon={Landmark}
          accent="finance"
          title="Link a bank"
          status={linkedBanks.length === 0 ? "None linked yet" : `${linkedBanks.length} linked`}
        />
        <DashboardCard
          href="/finances/uncategorised"
          icon={ClipboardCheck}
          accent="finance"
          title="Uncategorised"
          status={
            uncategorisedTransactions.length === 0
              ? "Nothing held for review"
              : `${uncategorisedTransactions.length} held for review`
          }
        />
        <DashboardCard
          href="/finances/statements"
          icon={FileBarChart}
          accent="finance"
          title="Statements"
          status="Overview, detail, compare & more"
        />

        <Card title="North Star">
          <FinanceNorthStarCard
            initialTarget={financeNorthStar.target}
            initialDeadline={financeNorthStar.deadline}
            accessibleNetWorth={accessible}
            actualMonthlyRate={monthlySurplus}
          />
        </Card>
        <Card id="baseline" title="Baseline">
          <BaselineForm
            initialIncome={baseline.monthlyIncome}
            initialOutgoings={baseline.fixedOutgoings}
          />
        </Card>
        <Card title="Goals">
          <GoalsManager initialGoals={goals} surplus={monthlySurplus} contributionCandidates={contributionCandidates} />
        </Card>
        <Card title="This month by category">
          <CategoryBreakdownView breakdown={categorySpending} />
        </Card>
        <Card title="Spend vs. usual">
          <SpendDeviationView whole={spendDeviationWhole} categories={spendDeviationCategories} />
        </Card>
        <Card title="Category trend">
          <CategoryTrendView months={trendMonths} rows={categoryTrend} />
        </Card>
        <Card title="Recurring charges">
          <RecurringChargesView charges={recurringCharges} />
        </Card>
        <Card title="Budget vs. actual">
          <BudgetVsActual initialStatuses={budgetStatuses} categories={categories} />
        </Card>
        <Card title="Transactions">
          <TransactionsManager
            initialTransactions={transactions}
            goals={goals}
            accounts={accounts}
            categories={categories}
            limit={RECENT_TRANSACTIONS_LIMIT}
          />
        </Card>
        <Card title="Receivables">
          <ReceivablesList initialReceivables={receivables} repaymentCandidates={repaymentCandidates} />
        </Card>
        <Card id="accounts" title="Accounts">
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

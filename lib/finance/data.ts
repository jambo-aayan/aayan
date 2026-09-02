import "server-only";
import { prisma } from "@/lib/prisma";
import { ensureBaselineExists } from "./ensure-baseline";
import { BASELINE_ID } from "./baseline-id";
import { ensureFinanceNorthStarExists } from "./ensure-north-star";
import { FINANCE_NORTH_STAR_ID } from "./north-star-id";
import { CONFIDENCE_THRESHOLD, sortGoalsByPriority } from "./logic";
import { buildTransactionQuery, type TransactionFilters } from "./transaction-query";

// Prisma's Decimal isn't a plain serializable value — Client Components
// need a plain number, so every read converts here at the DB boundary.

/** Each Account's value is its most recent Snapshot's balance, not a
 * stored column (ADR-0010) — resolved here in one batched query rather
 * than N+1 per account. */
export async function getAccounts() {
  const accounts = await prisma.account.findMany({
    orderBy: { createdAt: "asc" },
    include: { snapshots: { orderBy: { date: "desc" }, take: 1 } },
  });
  return accounts.map(({ snapshots, ...account }) => ({
    ...account,
    value: snapshots[0] ? snapshots[0].balance.toNumber() : 0,
    // A Valuation account's latest Snapshot may carry a confidence score
    // from statement-upload parsing (#116, ADR-0010) — null for a
    // manually entered value or a Transactional account (whose value
    // comes from summed transactions, not a parsed balance figure).
    valueConfidence: snapshots[0]?.confidence ?? null,
    // The Statements "Uploads" section's staleness signal (#118,
    // ADR-0010) — null when an account has never had a Snapshot at all.
    lastSnapshotDate: snapshots[0]?.date ?? null,
  }));
}

export async function getBaseline() {
  await ensureBaselineExists();
  const baseline = await prisma.baseline.findUniqueOrThrow({ where: { id: BASELINE_ID } });
  return {
    monthlyIncome: baseline.monthlyIncome.toNumber(),
    fixedOutgoings: baseline.fixedOutgoings.toNumber(),
  };
}

/** A Goal's saved figure is the computed sum of its GoalContribution
 * rows, not a stored column (#120, ADR-0010) — resolved here in one
 * batched query rather than N+1 per goal. */
export async function getGoals() {
  const goals = await prisma.goal.findMany({
    orderBy: { createdAt: "asc" },
    include: { contributions: { select: { amount: true } } },
  });
  const mapped = goals.map(({ contributions, ...goal }) => ({
    ...goal,
    target: goal.target.toNumber(),
    saved: contributions.reduce((sum, c) => sum + c.amount.toNumber(), 0),
    monthlyContribution: goal.monthlyContribution.toNumber(),
  }));
  return sortGoalsByPriority(mapped);
}

/** One Goal's full dated contribution log, most recent first (#120,
 * ADR-0010) — the detail view behind its computed `saved` total. */
export async function getGoalContributions(goalId: string) {
  const contributions = await prisma.goalContribution.findMany({
    where: { goalId },
    orderBy: { date: "desc" },
  });
  return contributions.map((c) => ({ ...c, amount: c.amount.toNumber() }));
}

export async function getFinanceNorthStar() {
  await ensureFinanceNorthStarExists();
  const northStar = await prisma.financeNorthStar.findUniqueOrThrow({
    where: { id: FINANCE_NORTH_STAR_ID },
  });
  return {
    target: northStar.target?.toNumber() ?? null,
    deadline: northStar.deadline,
  };
}

/** Resolves each Transaction's categoryId to its Category name (ADR-0015)
 * — every pure finance module (categoryBreakdown, categoryTimeSeries,
 * spend-deviation, ...) keeps consuming `category: string`, unchanged. */
export async function getTransactions() {
  const transactions = await prisma.transaction.findMany({
    orderBy: { date: "desc" },
    include: { category: true },
  });
  return transactions.map(({ category, amount, ...t }) => ({
    ...t,
    amount: amount.toNumber(),
    category: category.name,
  }));
}

/** The full user-editable Category list (ADR-0015) — Settings' category
 * management screen, and every category `<select>` in the app. */
export async function getCategories() {
  return prisma.category.findMany({ orderBy: { name: "asc" } });
}

function mapTransactionListItem<
  T extends {
    id: string;
    date: Date;
    amount: { toNumber(): number };
    direction: "IN" | "OUT";
    source: string | null;
    category: { name: string };
    account: { name: string } | null;
    statementId: string | null;
  },
>(t: T) {
  return {
    id: t.id,
    date: t.date,
    amount: t.amount.toNumber(),
    direction: t.direction,
    source: t.source,
    category: t.category.name,
    accountName: t.account?.name ?? null,
    statementId: t.statementId,
  };
}

// "Group by statement" mode has no per-transaction pagination — bounded
// instead by capping how many Statements it fetches (#150, ADR-0015).
// Each Statement's own transaction count is naturally small (however many
// lines a real bank statement has), so this is the one dimension that
// actually needed an explicit cap to stay bounded, the same reasoning
// that made #149's dedup query need a date-range bound instead of
// fetching a whole account's history.
const MAX_GROUPED_STATEMENTS = 100;

/** The full transaction browser's source data (#150, ADR-0015) — either a
 * flat, paginated page of Transactions, or every Transaction matching the
 * current filters grouped by the Statement it came from, per
 * `buildTransactionQuery`'s two modes. Fetches the category hierarchy so
 * a `categoryId` filter naming a top-level category expands to "any of
 * its subcategories" (#176) — cheap, and every category row is needed
 * for the filter picker itself anyway (see the transactions page). */
export async function getTransactionsPage(filters: TransactionFilters) {
  const categories = await prisma.category.findMany({ select: { id: true, name: true, parentId: true } });
  const query = buildTransactionQuery(filters, categories);
  const include = { category: true, account: { select: { name: true } } } as const;

  if (query.mode === "byStatement") {
    const statements = await prisma.statement.findMany({
      where: { transactions: { some: query.where } },
      orderBy: { uploadedAt: "desc" },
      take: MAX_GROUPED_STATEMENTS,
      include: { account: { select: { name: true } }, transactions: { where: query.where, orderBy: query.orderBy, include } },
    });
    return {
      mode: "byStatement" as const,
      statements: statements.map((s) => ({
        id: s.id,
        name: s.name,
        accountName: s.account.name,
        transactions: s.transactions.map(mapTransactionListItem),
      })),
    };
  }

  const [rows, total] = await Promise.all([
    prisma.transaction.findMany({ where: query.where, orderBy: query.orderBy, skip: query.skip, take: query.take, include }),
    prisma.transaction.count({ where: query.where }),
  ]);
  return {
    mode: "flat" as const,
    transactions: rows.map(mapTransactionListItem),
    total,
    page: Math.floor(query.skip / query.take) + 1,
    pageSize: query.take,
  };
}

/** Every uploaded statement, most recent first (#148, ADR-0015) — the
 * Statements page's own list, with each one's generated (or renamed)
 * name and which account it's for. */
export async function getStatements() {
  return prisma.statement.findMany({
    orderBy: { uploadedAt: "desc" },
    include: { account: { select: { name: true } } },
  });
}

export type FinanceSetupSteps = { baseline: boolean; accounts: boolean; goals: boolean };

/** The Finance-scoped setup checklist's source data (#122, ADR-0010) — a
 * smaller, Finance-only echo of the app-wide Day One idiom
 * (lib/onboarding/data.ts's getDayOneStatus). "Baseline set" means a
 * real figure has been entered, not just that the singleton row exists
 * (ensureBaselineExists seeds a zeroed row on first visit, same
 * reasoning as the North Star's own `target !== null` check) — checking
 * both income and outgoings rather than income alone, since a real £0
 * monthly income (between jobs, income tracked elsewhere) is a
 * plausible baseline someone would intentionally enter. */
export async function getFinanceSetupStatus(): Promise<{ complete: boolean; steps: FinanceSetupSteps }> {
  await ensureBaselineExists();
  const [baseline, accountCount, goalCount] = await Promise.all([
    prisma.baseline.findUnique({ where: { id: BASELINE_ID }, select: { monthlyIncome: true, fixedOutgoings: true } }),
    prisma.account.count(),
    prisma.goal.count(),
  ]);
  const steps: FinanceSetupSteps = {
    baseline: (baseline?.monthlyIncome.toNumber() ?? 0) > 0 || (baseline?.fixedOutgoings.toNumber() ?? 0) > 0,
    accounts: accountCount > 0,
    goals: goalCount > 0,
  };
  return { complete: steps.baseline && steps.accounts && steps.goals, steps };
}

/** Every standing category budget (#123, ADR-0010) — `budgetVsActual`
 * (lib/finance/category-breakdown.ts) turns this into spend-vs-limit
 * figures for a given month; this is just the raw limits. */
export async function getBudgets() {
  const budgets = await prisma.budget.findMany({ orderBy: { category: "asc" } });
  return budgets.map((b) => ({ ...b, limit: b.limit.toNumber() }));
}

export async function getReceivables() {
  const receivables = await prisma.receivable.findMany({ orderBy: { openedAt: "desc" } });
  return receivables.map((r) => ({ ...r, amount: r.amount.toNumber() }));
}

/** Every held-back (low-confidence) statement-parsed transaction, across
 * all accounts — the Uncategorised queue's source list (#117, ADR-0010).
 * Filtered at the DB level with the same threshold isHeldForReview uses,
 * so a manually entered transaction (confidence: null) never appears.
 * Also excludes anything already flagged as a receivable or a goal
 * contribution — reclassifying it either way (reusing #114/#120's flows,
 * per #117's AC) already resolves it, even though neither clears
 * confidence the way resolveHeldTransaction does. */
export async function getUncategorisedTransactions() {
  const transactions = await prisma.transaction.findMany({
    where: { confidence: { not: null, lt: CONFIDENCE_THRESHOLD }, receivableId: null, goalContributionId: null },
    orderBy: { date: "desc" },
    include: { account: { select: { name: true } }, category: true },
  });
  return transactions.map(({ category, amount, ...t }) => ({
    ...t,
    amount: amount.toNumber(),
    category: category.name,
  }));
}

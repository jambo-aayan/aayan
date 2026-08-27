import "server-only";
import { prisma } from "@/lib/prisma";
import { ensureBaselineExists } from "./ensure-baseline";
import { BASELINE_ID } from "./baseline-id";
import { ensureFinanceNorthStarExists } from "./ensure-north-star";
import { FINANCE_NORTH_STAR_ID } from "./north-star-id";
import { CONFIDENCE_THRESHOLD, sortGoalsByPriority } from "./logic";

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

export async function getGoals() {
  const goals = await prisma.goal.findMany({ orderBy: { createdAt: "asc" } });
  const mapped = goals.map((goal) => ({
    ...goal,
    target: goal.target.toNumber(),
    saved: goal.saved.toNumber(),
    monthlyContribution: goal.monthlyContribution.toNumber(),
  }));
  return sortGoalsByPriority(mapped);
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

export async function getTransactions() {
  const transactions = await prisma.transaction.findMany({ orderBy: { date: "desc" } });
  return transactions.map((t) => ({ ...t, amount: t.amount.toNumber() }));
}

export async function getReceivables() {
  const receivables = await prisma.receivable.findMany({ orderBy: { openedAt: "desc" } });
  return receivables.map((r) => ({ ...r, amount: r.amount.toNumber() }));
}

/** Every held-back (low-confidence) statement-parsed transaction, across
 * all accounts — the Uncategorised queue's source list (#117, ADR-0010).
 * Filtered at the DB level with the same threshold isHeldForReview uses,
 * so a manually entered transaction (confidence: null) never appears.
 * Also excludes anything already flagged as a receivable — reclassifying
 * it that way (reusing #114's flow, per #117's AC) already resolves it,
 * even though it doesn't clear confidence the way resolveHeldTransaction
 * does. */
export async function getUncategorisedTransactions() {
  const transactions = await prisma.transaction.findMany({
    where: { confidence: { not: null, lt: CONFIDENCE_THRESHOLD }, receivableId: null },
    orderBy: { date: "desc" },
    include: { account: { select: { name: true } } },
  });
  return transactions.map((t) => ({ ...t, amount: t.amount.toNumber() }));
}

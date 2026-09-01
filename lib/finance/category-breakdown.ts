import { isRealSpend } from "./logic";

export type TransactionForBreakdown = {
  date: Date;
  amount: number;
  direction: "IN" | "OUT";
  category: string;
  /** A transaction flagged "this became a receivable" is a loan, not
   * real spending — excluded from spend totals (ADR-0010). */
  receivableId: string | null;
  /** A transaction flagged "this went toward Goal X" is a goal
   * contribution, not real spending — excluded from spend totals the
   * same way receivableId is (#120, ADR-0010). */
  goalContributionId: string | null;
};

function isSameUtcMonth(date: Date, month: Date): boolean {
  return date.getUTCFullYear() === month.getUTCFullYear() && date.getUTCMonth() === month.getUTCMonth();
}

/** This-month spending (OUT only) grouped by category, sorted highest first. */
export function categoryBreakdown(
  transactions: TransactionForBreakdown[],
  month: Date
): { category: string; total: number }[] {
  const totals = new Map<string, number>();

  for (const t of transactions) {
    if (t.direction !== "OUT" || !isSameUtcMonth(t.date, month) || !isRealSpend(t)) continue;
    totals.set(t.category, (totals.get(t.category) ?? 0) + t.amount);
  }

  return [...totals.entries()]
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total);
}

/** Extends the current pace (spend-so-far ÷ days elapsed × days in the
 * month) to estimate where a category will land by month-end (#123,
 * ADR-0010) — null when no days have elapsed yet, rather than a
 * divide-by-zero fabrication. */
export function projectedMonthEndSpend(spentSoFar: number, daysElapsed: number, daysInMonth: number): number | null {
  if (daysElapsed <= 0) return null;
  return (spentSoFar / daysElapsed) * daysInMonth;
}

export type BudgetLimit = { category: string; limit: number };

export type BudgetStatus = {
  category: string;
  limit: number;
  spent: number;
  /** limit - spent — negative means over budget. */
  remaining: number;
  projected: number | null;
};

/** Categories are free text, not an enum (lib/finance/categories.ts) —
 * matching a Budget's category against a Transaction's exactly would
 * silently show £0 spent for a budget typed "food" against transactions
 * categorized "Food", with no error or indication of the mismatch. */
function normalizeCategory(category: string): string {
  return category.trim().toLowerCase();
}

/** Budget vs. actual for every budgeted category, for one month (#123,
 * ADR-0010) — reuses categoryBreakdown's own spend computation (and its
 * receivable/goal-contribution exclusion) rather than a parallel
 * implementation, so budget tracking can never drift from what "spend
 * totals" means elsewhere. Matches budget-to-transaction categories
 * case/whitespace-insensitively (normalizeCategory), so "food" and
 * "Food " are the same budget. A category with no Budget row never
 * appears here — this only reports on categories the user chose to
 * limit. No rollover: `limit` is read fresh each month, an under-spent
 * category's leftover never carries forward. */
export function budgetVsActual(
  transactions: TransactionForBreakdown[],
  month: Date,
  budgets: BudgetLimit[],
  daysElapsed: number,
  daysInMonth: number
): BudgetStatus[] {
  const spendByCategory = new Map(
    categoryBreakdown(transactions, month).map((c) => [normalizeCategory(c.category), c.total])
  );
  return budgets.map((b) => {
    const spent = spendByCategory.get(normalizeCategory(b.category)) ?? 0;
    return {
      category: b.category,
      limit: b.limit,
      spent,
      remaining: b.limit - spent,
      projected: projectedMonthEndSpend(spent, daysElapsed, daysInMonth),
    };
  });
}

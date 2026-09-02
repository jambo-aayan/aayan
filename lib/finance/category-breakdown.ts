import { isRealSpend } from "./logic";

export type TransactionForBreakdown = {
  date: Date;
  amount: number;
  direction: "IN" | "OUT";
  /** The subcategory (leaf) name a Transaction always categorizes at —
   * see ADR-0015's #173 addendum. */
  category: string;
  /** That leaf's parent category name (#173/#177) — e.g. "Dining Out"'s
   * categoryParent is "Food". */
  categoryParent: string;
  /** A transaction flagged "this became a receivable" is a loan, not
   * real spending — excluded from spend totals (ADR-0010). */
  receivableId: string | null;
  /** A transaction flagged "this went toward Goal X" is a goal
   * contribution, not real spending — excluded from spend totals the
   * same way receivableId is (#120, ADR-0010). */
  goalContributionId: string | null;
  /** A transaction linked as one side of a Transfer (money moving between
   * the user's own accounts) is neither real spend nor income — excluded
   * the same way (#138, ADR-0013). */
  transferId: string | null;
};

export type CategoryBreakdownRow = { category: string; total: number };
export type CategoryDrilldownRow = { category: string; categoryParent: string; total: number };

/** A collision-safe map key for a (leaf, parent) pair — exported so
 * spend-deviation.ts's categorySpendDeviation can key its own baseline
 * Maps identically to categoryDrilldownBreakdown's rows below, rather
 * than each file hand-rolling the same composite-key format
 * independently and risking the two silently drifting apart. */
export function drilldownKey(category: string, categoryParent: string): string {
  return `${categoryParent} ${category}`;
}

function isSameUtcMonth(date: Date, month: Date): boolean {
  return date.getUTCFullYear() === month.getUTCFullYear() && date.getUTCMonth() === month.getUTCMonth();
}

function inScopeForBreakdown(t: TransactionForBreakdown, month: Date): boolean {
  return t.direction === "OUT" && isSameUtcMonth(t.date, month) && isRealSpend(t);
}

/** This-month spending (OUT only) grouped by leaf category name alone,
 * sorted highest first — unchanged in shape/behavior from before the
 * hierarchy (#173): `budgetVsActual` below still matches against this by
 * bare name, and `Budget.category` is (still) free text with no parent
 * concept of its own, so keeping this grouping bare-name-keyed is what
 * keeps Budget vs. actual working unchanged. The one accepted tradeoff:
 * if two different parents ever have a same-named child (the current
 * taxonomy's only case is "General," under both Shopping and Travel),
 * their spend collapses into one row here — narrow, pre-existing-shaped
 * (Budget's own free-text schema has no way to disambiguate this either),
 * and not something this ticket fixes. `categoryDrilldownBreakdown` below
 * is the collision-safe alternative for callers that don't need
 * bare-name compatibility. */
export function categoryBreakdown(transactions: TransactionForBreakdown[], month: Date): CategoryBreakdownRow[] {
  const totals = new Map<string, number>();

  for (const t of transactions) {
    if (!inScopeForBreakdown(t, month)) continue;
    totals.set(t.category, (totals.get(t.category) ?? 0) + t.amount);
  }

  return [...totals.entries()]
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total);
}

/** This-month spending grouped by (leaf, parent) pair — collision-safe
 * even when two different parents share a child name, unlike
 * `categoryBreakdown` above. The "drill-down" half of #177's rollup +
 * drill-down pair, for callers (the category-spend Visual adapter #178,
 * the Insights spend card #180) that display or key on the parent
 * alongside the leaf and so don't need `categoryBreakdown`'s
 * Budget-compatible bare-name grouping. */
export function categoryDrilldownBreakdown(transactions: TransactionForBreakdown[], month: Date): CategoryDrilldownRow[] {
  const totals = new Map<string, CategoryDrilldownRow>();

  for (const t of transactions) {
    if (!inScopeForBreakdown(t, month)) continue;
    const key = drilldownKey(t.category, t.categoryParent);
    const existing = totals.get(key);
    totals.set(key, { category: t.category, categoryParent: t.categoryParent, total: (existing?.total ?? 0) + t.amount });
  }

  return [...totals.values()].sort((a, b) => b.total - a.total);
}

/** This-month spending rolled up to just the top-level category, sorted
 * highest first — the "rollup" half of #177's rollup + drill-down pair. */
export function categoryParentBreakdown(transactions: TransactionForBreakdown[], month: Date): CategoryBreakdownRow[] {
  const totals = new Map<string, number>();

  for (const t of transactions) {
    if (!inScopeForBreakdown(t, month)) continue;
    totals.set(t.categoryParent, (totals.get(t.categoryParent) ?? 0) + t.amount);
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

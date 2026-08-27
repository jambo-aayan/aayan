import { categoryBreakdown } from "./category-breakdown";

export type StatementTransaction = {
  id: string;
  date: Date;
  amount: number;
  direction: "IN" | "OUT";
  category: string;
  source: string | null;
  receivableId: string | null;
  goalContributionId: string | null;
};

function isSameUtcMonth(date: Date, month: Date): boolean {
  return date.getUTCFullYear() === month.getUTCFullYear() && date.getUTCMonth() === month.getUTCMonth();
}

function isRealSpend(t: StatementTransaction): boolean {
  return t.direction === "OUT" && t.receivableId === null && t.goalContributionId === null;
}

function monthSpendTotal(transactions: StatementTransaction[], month: Date): number {
  return transactions
    .filter((t) => isRealSpend(t) && isSameUtcMonth(t.date, month))
    .reduce((sum, t) => sum + t.amount, 0);
}

export type MonthDiff = { currentTotal: number; previousTotal: number; diffAmount: number; diffPercent: number | null };

/** Month-over-month spend diff callout for the Statements Overview
 * (#118, ADR-0010) — excludes receivable-flagged transactions, same as
 * categoryBreakdown, since a loan out is never real spending. */
export function monthOverMonthDiff(transactions: StatementTransaction[], currentMonth: Date, previousMonth: Date): MonthDiff {
  const currentTotal = monthSpendTotal(transactions, currentMonth);
  const previousTotal = monthSpendTotal(transactions, previousMonth);
  return {
    currentTotal,
    previousTotal,
    diffAmount: currentTotal - previousTotal,
    diffPercent: previousTotal === 0 ? null : ((currentTotal - previousTotal) / previousTotal) * 100,
  };
}

/** Percentage of income not spent — null when income is zero rather than
 * a divide-by-zero fabrication. */
export function savingsRate(income: number, spend: number): number | null {
  if (income === 0) return null;
  return ((income - spend) / income) * 100;
}

export type CategoryTimeSeriesRow = { category: string; totals: number[] };

/** Per-category spend across a sequence of months (Detail section, #118,
 * ADR-0010) — reuses categoryBreakdown per month rather than a parallel
 * implementation, aligned into one row per category so a category with
 * no spend in a given month still shows a 0 there rather than a gap. */
export function categoryTimeSeries(transactions: StatementTransaction[], months: Date[]): CategoryTimeSeriesRow[] {
  const perMonth = months.map((m) => new Map(categoryBreakdown(transactions, m).map((c) => [c.category, c.total])));
  const categories = new Set<string>();
  for (const monthMap of perMonth) {
    for (const category of monthMap.keys()) categories.add(category);
  }
  return [...categories].sort().map((category) => ({
    category,
    totals: perMonth.map((monthMap) => monthMap.get(category) ?? 0),
  }));
}

export type MerchantTotal = { source: string; total: number; count: number };

/** Top merchants by total spend (#118, ADR-0010) — groups by the
 * Transaction's `source` field, doubling as merchant/description per its
 * established reuse (see components/transactions-manager.tsx). */
export function topMerchants(transactions: StatementTransaction[], limit: number): MerchantTotal[] {
  const totals = new Map<string, { total: number; count: number }>();
  for (const t of transactions) {
    if (!isRealSpend(t)) continue;
    const key = t.source ?? "Unknown";
    const existing = totals.get(key) ?? { total: 0, count: 0 };
    totals.set(key, { total: existing.total + t.amount, count: existing.count + 1 });
  }
  return [...totals.entries()]
    .map(([source, v]) => ({ source, ...v }))
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
}

export type RecurringCharge = { source: string; amount: number; occurrences: number };

/** Detected subscriptions/recurring charges (#118, ADR-0010) — a
 * source+amount pair appearing in 2+ distinct calendar months, not just
 * repeated within one month (a coffee shop visited twice in August isn't
 * a subscription). */
export function detectRecurringCharges(transactions: StatementTransaction[]): RecurringCharge[] {
  const bySourceAmount = new Map<string, { source: string; amount: number; months: Set<string> }>();
  for (const t of transactions) {
    if (!isRealSpend(t) || t.source === null) continue;
    const key = `${t.source}::${t.amount}`;
    const monthKey = `${t.date.getUTCFullYear()}-${t.date.getUTCMonth()}`;
    const existing = bySourceAmount.get(key) ?? { source: t.source, amount: t.amount, months: new Set<string>() };
    existing.months.add(monthKey);
    bySourceAmount.set(key, existing);
  }
  return [...bySourceAmount.values()]
    .filter((v) => v.months.size >= 2)
    .map((v) => ({ source: v.source, amount: v.amount, occurrences: v.months.size }));
}

/** Anomaly flags (#118, ADR-0010) — a transaction more than 2x its
 * category's mean, only judged once a category has 3+ data points (too
 * few to have a meaningful "typical" amount otherwise). Returns the
 * flagged transaction ids, not amounts, so callers can highlight rows in
 * place rather than re-deriving them. */
export function detectAnomalies(transactions: StatementTransaction[]): string[] {
  const byCategory = new Map<string, StatementTransaction[]>();
  for (const t of transactions) {
    if (!isRealSpend(t)) continue;
    const list = byCategory.get(t.category) ?? [];
    list.push(t);
    byCategory.set(t.category, list);
  }

  const flagged: string[] = [];
  for (const list of byCategory.values()) {
    if (list.length < 3) continue;
    const total = list.reduce((sum, t) => sum + t.amount, 0);
    for (const t of list) {
      // The "typical" amount excludes the candidate itself — otherwise a
      // single dominant spike drags its own threshold up and can mask
      // itself as normal, especially in a small category.
      const othersMean = (total - t.amount) / (list.length - 1);
      if (t.amount > othersMean * 2) flagged.push(t.id);
    }
  }
  return flagged;
}

export type YoYComparison = { currentTotal: number; priorYearTotal: number; diffPercent: number | null };

/** Same-month year-over-year comparison — honestly reports null ("needs
 * a second year") until a transaction actually exists in the same
 * calendar month a year earlier, rather than fabricating a comparison
 * against zero (#118, ADR-0010, matching Phase 4's widget-threshold-
 * honesty pattern — see lib/systems/widgets.ts). */
export function yearOverYearComparison(transactions: StatementTransaction[], month: Date): YoYComparison | null {
  const priorYearMonth = new Date(Date.UTC(month.getUTCFullYear() - 1, month.getUTCMonth(), 1));
  const hasPriorYearData = transactions.some((t) => isRealSpend(t) && isSameUtcMonth(t.date, priorYearMonth));
  if (!hasPriorYearData) return null;

  const currentTotal = monthSpendTotal(transactions, month);
  const priorYearTotal = monthSpendTotal(transactions, priorYearMonth);
  return {
    currentTotal,
    priorYearTotal,
    diffPercent: priorYearTotal === 0 ? null : ((currentTotal - priorYearTotal) / priorYearTotal) * 100,
  };
}

export type AccountUpload = { id: string; name: string; lastUpdated: Date | null };
export type AccountFreshness = AccountUpload & { stale: boolean };

/** Per-account "last updated" with a soft staleness flag (#118, ADR-0010)
 * — an account with no Snapshot at all is treated as stale (nothing to
 * be fresh about), same as one whose latest Snapshot is older than the
 * threshold. `today` is a full-precision instant (e.g. `new Date()`)
 * compared against `lastUpdated`'s `@db.Date` (UTC midnight) — at a
 * days-granularity threshold like this, the sub-day mismatch between the
 * two never changes which side of the threshold an account falls on. */
export function accountFreshness(accounts: AccountUpload[], today: Date, staleDays: number): AccountFreshness[] {
  const staleMs = staleDays * 24 * 60 * 60 * 1000;
  return accounts.map((a) => ({
    ...a,
    stale: a.lastUpdated === null || today.getTime() - a.lastUpdated.getTime() > staleMs,
  }));
}

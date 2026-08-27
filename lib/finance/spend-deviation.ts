import { categoryBreakdown, type TransactionForBreakdown } from "./category-breakdown";

export const SPEND_DEVIATION_BASELINE_MONTHS = 3;
export const SPEND_DEVIATION_CALLOUT_PERCENT = 20;

export type SpendDeviationCallout = "more" | "less" | null;

export type SpendDeviation = {
  current: number;
  baseline: number;
  diffAmount: number;
  diffPercent: number;
  callout: SpendDeviationCallout;
};

export type CategorySpendDeviation = SpendDeviation & { category: string };

function precedingMonths(month: Date, count: number): Date[] {
  return Array.from({ length: count }, (_, i) => new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() - (count - i), 1)));
}

function calloutFor(diffPercent: number): SpendDeviationCallout {
  if (diffPercent >= SPEND_DEVIATION_CALLOUT_PERCENT) return "more";
  if (diffPercent <= -SPEND_DEVIATION_CALLOUT_PERCENT) return "less";
  return null;
}

function deviationFrom(current: number, baseline: number): SpendDeviation {
  const diffAmount = current - baseline;
  const diffPercent = (diffAmount / baseline) * 100;
  return { current, baseline, diffAmount, diffPercent, callout: calloutFor(diffPercent) };
}

function monthSpendTotal(transactions: TransactionForBreakdown[], month: Date): number {
  return categoryBreakdown(transactions, month).reduce((sum, c) => sum + c.total, 0);
}

/** Every category's current spend vs. its own trailing-3-month baseline
 * (ADR-0012) — a category is only eligible once it has nonzero spend in
 * EACH of the 3 calendar months immediately preceding `month`, not just
 * that 3 months have elapsed, so a baseline is never built on mostly-empty
 * months. An ineligible category is omitted entirely, never included with
 * a fabricated null/zero deviation. */
export function categorySpendDeviation(transactions: TransactionForBreakdown[], month: Date): CategorySpendDeviation[] {
  const priorMonths = precedingMonths(month, SPEND_DEVIATION_BASELINE_MONTHS);
  const priorBreakdowns = priorMonths.map((m) => new Map(categoryBreakdown(transactions, m).map((c) => [c.category, c.total])));
  const currentBreakdown = new Map(categoryBreakdown(transactions, month).map((c) => [c.category, c.total]));

  const allCategories = new Set<string>();
  for (const breakdown of priorBreakdowns) {
    for (const category of breakdown.keys()) allCategories.add(category);
  }
  const eligibleCategories = [...allCategories].filter((category) =>
    priorBreakdowns.every((breakdown) => (breakdown.get(category) ?? 0) > 0)
  );

  return eligibleCategories
    .map((category) => {
      const current = currentBreakdown.get(category) ?? 0;
      const baseline = priorBreakdowns.reduce((sum, breakdown) => sum + (breakdown.get(category) ?? 0), 0) / SPEND_DEVIATION_BASELINE_MONTHS;
      return { category, ...deviationFrom(current, baseline) };
    })
    .sort((a, b) => b.diffPercent - a.diffPercent);
}

/** Same trailing-3-month-baseline comparison as categorySpendDeviation,
 * but over whole-month spend (ADR-0012) — null when the 3 preceding
 * months don't each have nonzero spend, rather than a fabricated
 * comparison against a partly-empty baseline. */
export function totalSpendDeviation(transactions: TransactionForBreakdown[], month: Date): SpendDeviation | null {
  const priorMonths = precedingMonths(month, SPEND_DEVIATION_BASELINE_MONTHS);
  const priorTotals = priorMonths.map((m) => monthSpendTotal(transactions, m));
  if (priorTotals.some((total) => total <= 0)) return null;

  const baseline = priorTotals.reduce((sum, total) => sum + total, 0) / SPEND_DEVIATION_BASELINE_MONTHS;
  const current = monthSpendTotal(transactions, month);
  return deviationFrom(current, baseline);
}

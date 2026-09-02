import { categoryBreakdown, categoryDrilldownBreakdown, type TransactionForBreakdown } from "./category-breakdown";

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

/** categoryParent alongside category (#173/#177) — unlike
 * `categoryBreakdown`, this module has no Budget-style free-text
 * bare-name consumer to stay compatible with, so it uses
 * `categoryDrilldownBreakdown`'s collision-safe (leaf, parent) grouping
 * throughout: two different categories sharing a leaf name (the current
 * taxonomy's only case is "General," under Shopping and Travel) get
 * their own, correctly separate deviation entries here. */
export type CategorySpendDeviation = SpendDeviation & { category: string; categoryParent: string };

function precedingMonths(month: Date, count: number): Date[] {
  return Array.from({ length: count }, (_, i) => new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() - (count - i), 1)));
}

function calloutFor(diffPercent: number): SpendDeviationCallout {
  if (diffPercent >= SPEND_DEVIATION_CALLOUT_PERCENT) return "more";
  if (diffPercent <= -SPEND_DEVIATION_CALLOUT_PERCENT) return "less";
  return null;
}

/** Exported so #179/#180 (the category-spend anomaly nudge and Insights
 * card) can compute the same current-vs-baseline shape against a
 * baseline they derive themselves, without duplicating this math. */
export function deviationFrom(current: number, baseline: number): SpendDeviation {
  const diffAmount = current - baseline;
  const diffPercent = (diffAmount / baseline) * 100;
  return { current, baseline, diffAmount, diffPercent, callout: calloutFor(diffPercent) };
}

function monthSpendTotal(transactions: TransactionForBreakdown[], month: Date): number {
  return categoryBreakdown(transactions, month).reduce((sum, c) => sum + c.total, 0);
}

function drilldownKey(category: string, categoryParent: string): string {
  return `${categoryParent} ${category}`;
}

/** Every (leaf) category's current spend vs. its own trailing-3-month
 * baseline (ADR-0012) — a category is only eligible once it has nonzero
 * spend in EACH of the 3 calendar months immediately preceding `month`,
 * not just that 3 months have elapsed, so a baseline is never built on
 * mostly-empty months. An ineligible category is omitted entirely, never
 * included with a fabricated null/zero deviation. */
export function categorySpendDeviation(transactions: TransactionForBreakdown[], month: Date): CategorySpendDeviation[] {
  const priorMonths = precedingMonths(month, SPEND_DEVIATION_BASELINE_MONTHS);
  const priorBreakdowns = priorMonths.map(
    (m) => new Map(categoryDrilldownBreakdown(transactions, m).map((c) => [drilldownKey(c.category, c.categoryParent), c]))
  );
  const currentBreakdown = new Map(
    categoryDrilldownBreakdown(transactions, month).map((c) => [drilldownKey(c.category, c.categoryParent), c])
  );

  const allKeys = new Map<string, { category: string; categoryParent: string }>();
  for (const breakdown of priorBreakdowns) {
    for (const [key, row] of breakdown) allKeys.set(key, row);
  }
  const eligibleKeys = [...allKeys.entries()].filter(([key]) =>
    priorBreakdowns.every((breakdown) => (breakdown.get(key)?.total ?? 0) > 0)
  );

  return eligibleKeys
    .map(([key, { category, categoryParent }]) => {
      const current = currentBreakdown.get(key)?.total ?? 0;
      const baseline =
        priorBreakdowns.reduce((sum, breakdown) => sum + (breakdown.get(key)?.total ?? 0), 0) / SPEND_DEVIATION_BASELINE_MONTHS;
      return { category, categoryParent, ...deviationFrom(current, baseline) };
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

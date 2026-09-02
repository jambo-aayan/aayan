import { categoryDrilldownBreakdown, drilldownKey, type TransactionForBreakdown } from "../finance/category-breakdown";
import { categorySpendDeviation, type SpendDeviationCallout } from "../finance/spend-deviation";

export type CategorySpendTrendRow = {
  category: string;
  categoryParent: string;
  /** One total per entry in the `months` array passed to
   * `categorySpendTrend`, in the same order (oldest first). */
  totals: number[];
  /** This category's ADR-0012 deviation callout for the *last* month in
   * `months` (the current month, by convention) — null when it doesn't
   * have 3 full qualifying prior months yet, same "omit rather than
   * fabricate" rule categorySpendDeviation itself follows. */
  callout: SpendDeviationCallout;
};

/** Per-(leaf category) monthly spend trend, each row flagged with its own
 * spend-deviation callout for the trend's final month (#180) — the
 * comprehensive, always-on complement to #179's one-off anomaly nudge:
 * every category with any spend in the window, not just the ones
 * currently over threshold. Reuses `categoryDrilldownBreakdown` (#177,
 * collision-safe leaf+parent grouping) per month rather than
 * `categoryBreakdown`'s bare-name grouping, mirroring
 * lib/finance/statements.ts's own `categoryTimeSeries` but hierarchy-safe
 * — the same reasoning `categorySpendDeviation` itself already uses. */
export function categorySpendTrend(transactions: TransactionForBreakdown[], months: Date[]): CategorySpendTrendRow[] {
  if (months.length === 0) return [];

  const perMonth = months.map(
    (m) => new Map(categoryDrilldownBreakdown(transactions, m).map((row) => [drilldownKey(row.category, row.categoryParent), row]))
  );
  const keys = new Set<string>();
  for (const monthMap of perMonth) {
    for (const key of monthMap.keys()) keys.add(key);
  }

  const lastMonth = months[months.length - 1];
  const calloutByKey = new Map(
    categorySpendDeviation(transactions, lastMonth).map((d) => [drilldownKey(d.category, d.categoryParent), d.callout])
  );

  return [...keys]
    .map((key) => {
      const anyRow = perMonth.map((m) => m.get(key)).find((r) => r !== undefined)!;
      return {
        category: anyRow.category,
        categoryParent: anyRow.categoryParent,
        totals: perMonth.map((m) => m.get(key)?.total ?? 0),
        callout: calloutByKey.get(key) ?? null,
      };
    })
    .sort((a, b) => b.totals[b.totals.length - 1] - a.totals[a.totals.length - 1]);
}

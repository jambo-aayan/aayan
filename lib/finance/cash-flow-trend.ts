export type TransactionForTrend = {
  date: Date;
  amount: number;
  direction: "IN" | "OUT";
};

export type CashFlowPoint = { date: Date; cumulative: number };

/**
 * A cumulative running balance from actual Transactions, ordered by date —
 * the only real time-series signal available. Not the same thing as
 * "net worth over time" (no historical Item-value snapshots exist to
 * chart that honestly), so this is presented as cash flow, not net worth.
 * Unlike categoryBreakdown, this is NOT receivable-aware — a Receivable
 * flag excludes a transaction from spend *totals* (ADR-0010's Receivable
 * section), but real cash still left the account, so it stays in the
 * actual cash-movement trend.
 */
export function cashFlowTrend(transactions: TransactionForTrend[]): CashFlowPoint[] {
  const byDay = new Map<number, number>();
  for (const t of transactions) {
    const key = t.date.getTime();
    const signed = t.direction === "IN" ? t.amount : -t.amount;
    byDay.set(key, (byDay.get(key) ?? 0) + signed);
  }

  const sortedDays = [...byDay.keys()].sort((a, b) => a - b);
  let running = 0;
  return sortedDays.map((key) => {
    running += byDay.get(key)!;
    return { date: new Date(key), cumulative: running };
  });
}

/** Finds the plotted point nearest a hover x-coordinate (ADR-0015) —
 * `points` are assumed evenly spaced by index across `width` (the SVG
 * chart's own layout, TrendChart's `x = (i / (n-1)) * width`), so the
 * nearest point is a direct ratio-to-index conversion, not a distance
 * search. Clamped to the first/last point outside [0, width]. Returns
 * the point's own `index` alongside its data, so the caller can
 * reposition a guide line without recomputing it. */
export function nearestCashFlowPoint(
  points: CashFlowPoint[],
  x: number,
  width: number
): (CashFlowPoint & { index: number }) | null {
  if (points.length === 0) return null;
  if (points.length === 1) return { ...points[0], index: 0 };
  const ratio = Math.min(1, Math.max(0, x / width));
  const index = Math.round(ratio * (points.length - 1));
  return { ...points[index], index };
}

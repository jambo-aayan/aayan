export type TransactionForTrend = { date: Date; amount: number; direction: "IN" | "OUT" };

/**
 * A cumulative running balance from actual Transactions, ordered by date —
 * the only real time-series signal available. Not the same thing as
 * "net worth over time" (no historical Item-value snapshots exist to
 * chart that honestly), so this is presented as cash flow, not net worth.
 */
export function cashFlowTrend(transactions: TransactionForTrend[]): { date: Date; cumulative: number }[] {
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

export type TransactionForBreakdown = {
  date: Date;
  amount: number;
  direction: "IN" | "OUT";
  category: string;
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
    if (t.direction !== "OUT" || !isSameUtcMonth(t.date, month)) continue;
    totals.set(t.category, (totals.get(t.category) ?? 0) + t.amount);
  }

  return [...totals.entries()]
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total);
}

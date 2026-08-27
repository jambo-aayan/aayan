export type TransactionForBreakdown = {
  date: Date;
  amount: number;
  direction: "IN" | "OUT";
  category: string;
  /** A transaction flagged "this became a receivable" is a loan, not
   * real spending — excluded from spend totals (ADR-0010). */
  receivableId: string | null;
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
    if (t.direction !== "OUT" || !isSameUtcMonth(t.date, month) || t.receivableId !== null) continue;
    totals.set(t.category, (totals.get(t.category) ?? 0) + t.amount);
  }

  return [...totals.entries()]
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total);
}

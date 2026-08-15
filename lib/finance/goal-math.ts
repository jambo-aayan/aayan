export function goalProgressPercent(saved: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(100, Math.round((saved / target) * 100));
}

/** Projects the completion date at the current monthly contribution rate, or null if it never completes. */
export function projectedCompletionDate(
  saved: number,
  target: number,
  monthlyContribution: number,
  now: Date
): Date | null {
  const remaining = target - saved;
  if (remaining <= 0) return null;
  if (monthlyContribution <= 0) return null;

  const monthsNeeded = Math.ceil(remaining / monthlyContribution);
  const result = new Date(now);
  result.setUTCMonth(result.getUTCMonth() + monthsNeeded);
  return result;
}

export function totalMonthlyContributions(goals: { monthlyContribution: number }[]): number {
  return goals.reduce((sum, g) => sum + g.monthlyContribution, 0);
}

export function isOvercommitted(totalContributions: number, surplus: number): boolean {
  return totalContributions > surplus;
}

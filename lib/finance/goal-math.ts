import { progressPercent } from "../visuals/config";

/** Delegates to the one canonical current/target → percent formula (#171,
 * ADR-0017) — the same one behind a Progress bar Visual's fill width and
 * Finance's own goal rings, so both ultimately compute the same number
 * from the same rule rather than two near-identical formulas drifting
 * apart. Every existing call site/test importing goalProgressPercent from
 * here is untouched; only the body changed. */
export function goalProgressPercent(saved: number, target: number): number {
  return progressPercent(saved, target);
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

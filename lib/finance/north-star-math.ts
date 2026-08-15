export type Verdict = "ON_TRACK" | "BEHIND";

function wholeMonthsBetween(from: Date, to: Date): number {
  const months = (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth());
  return Math.max(1, months);
}

/** The monthly saving rate needed to hit `target` by `deadline`, starting from `currentAccessible`. */
export function requiredMonthlyRate(
  currentAccessible: number,
  target: number,
  deadline: Date,
  now: Date
): number {
  const shortfall = target - currentAccessible;
  if (shortfall <= 0) return 0;
  return shortfall / wholeMonthsBetween(now, deadline);
}

export function verdict(actualMonthlyRate: number, requiredRate: number): Verdict {
  return actualMonthlyRate >= requiredRate ? "ON_TRACK" : "BEHIND";
}

/** "On current trajectory" — currentAccessible grown at actualMonthlyRate for `years`. */
export function projectedValue(currentAccessible: number, actualMonthlyRate: number, years: number): number {
  return currentAccessible + actualMonthlyRate * 12 * years;
}

import { evaluationScore } from "../systems/evaluation";

/** Pure transforms for the four bindable chart sources (#166, ADR-0017) —
 * each turns a source's own raw rows into the same date+value shape
 * dateValuePoints/heatmapIntensities already read off ad-hoc VisualRecords,
 * so lib/visuals/resolve-binding.ts can synthesize records a bound chart
 * renders through the exact same components as an ad-hoc one. Pure — no
 * Prisma/React — mirrors lib/finance/cash-flow-trend.ts's own
 * fetch/transform split, with the impure fetch living in
 * resolve-binding.ts instead. */

export type SyntheticPoint = { date: Date; value: number };

/** Habit check-ins: FULL counts as 1, MINIMUM as a half-credit 0.5. */
export function checkinPoints(checkIns: { date: Date; level: "FULL" | "MINIMUM" }[]): SyntheticPoint[] {
  return checkIns
    .map((c) => ({ date: c.date, value: c.level === "FULL" ? 1 : 0.5 }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

/** System evaluations: reuses lib/systems/evaluation.ts's own
 * evaluationScore — the same canonical "overall score" a System's own
 * evaluation UI shows, not a second copy of that formula that could drift
 * from it. */
export function evaluationPoints(
  evaluations: { date: Date; effectiveness: number; consistency: number; sustainability: number }[]
): SyntheticPoint[] {
  return evaluations
    .map((e) => ({ date: e.date, value: evaluationScore(e) }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

/** Goal progress: a running total of contributions over time — "saved vs.
 * target" needs the cumulative figure at each date, not each
 * contribution's own amount in isolation. Same-day contributions merge
 * into one point first, same as lib/finance/cash-flow-trend.ts's
 * cashFlowTrend, so two contributions logged the same day plot as one
 * point rather than two at the same x-position. */
export function goalProgressPoints(contributions: { date: Date; amount: number }[]): SyntheticPoint[] {
  const byDay = new Map<number, number>();
  for (const c of contributions) {
    const key = c.date.getTime();
    byDay.set(key, (byDay.get(key) ?? 0) + c.amount);
  }

  const sortedDays = [...byDay.keys()].sort((a, b) => a - b);
  let running = 0;
  return sortedDays.map((key) => {
    running += byDay.get(key)!;
    return { date: new Date(key), value: running };
  });
}

/** Finance balances: an Account's own Snapshot history, unchanged. */
export function balancePoints(snapshots: { date: Date; balance: number }[]): SyntheticPoint[] {
  return snapshots
    .map((s) => ({ date: s.date, value: s.balance }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

export type XYPoint = { x: number; y: number };

/** Scatter's own join (#167) — its two axes can bind to two entirely
 * different sources (e.g. a Habit's check-ins against a System's
 * evaluation scores), so there's no shared "the" date axis to plot
 * against like every other bound chart type. Instead, pairs an X point
 * with a Y point only where both sources have a value on the exact same
 * date — a date present in only one series contributes no point, since
 * there's nothing to pair it with. */
export function joinPointsByDate(xPoints: SyntheticPoint[], yPoints: SyntheticPoint[]): XYPoint[] {
  const yByDay = new Map<number, number>();
  for (const p of yPoints) yByDay.set(p.date.getTime(), p.value);

  return xPoints
    .filter((p) => yByDay.has(p.date.getTime()))
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map((p) => ({ x: p.value, y: yByDay.get(p.date.getTime())! }));
}

/** A mixed-binding Scatter's join (#167) — one axis bound to a live
 * source, the other still ad-hoc. Ad-hoc points carry no date (Scatter's
 * manual entry form never asked for one, even before binding existed), so
 * there's nothing to match the bound series' dates against — pairing is
 * by index instead: the Nth manually-entered value pairs with the Nth
 * point of the bound series, sorted chronologically. `manualValues` is
 * expected in the order the points were added (oldest first). Truncates
 * to the shorter of the two — an unpaired tail on either side contributes
 * no point, same "nothing to pair it with" rule as joinPointsByDate. */
export type BoundManualPair = { bound: number; manual: number };

export function joinBoundWithManual(boundPoints: SyntheticPoint[], manualValues: number[]): BoundManualPair[] {
  const sorted = [...boundPoints].sort((a, b) => a.date.getTime() - b.date.getTime());
  const n = Math.min(sorted.length, manualValues.length);
  return Array.from({ length: n }, (_, i) => ({ bound: sorted[i].value, manual: manualValues[i] }));
}

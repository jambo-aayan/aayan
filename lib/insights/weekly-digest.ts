export type DeltaFixture = { label: string; delta: number };

/** `expectedSign` is the prior this app holds about the pair's direction
 * — 1 = expected positive, -1 = expected negative (e.g. more habit
 * adherence should reduce pain), 0 = no prior to contradict. Only pairs
 * with a nonzero prior can ever be "surprising." */
export type CorrelationFixture = { labelA: string; labelB: string; r: number; expectedSign: 1 | -1 | 0 };

export type HabitAdherenceFixture = { name: string; pct: number };

export type WeeklyDigest = {
  worked: string[];
  slipped: string[];
  surprising: string;
  oneThing: string;
};

const SURPRISE_MIN_ABS_R = 0.35;

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Top 2 positive deltas, most positive first. */
function computeWorked(deltas: DeltaFixture[]): string[] {
  return deltas
    .filter((d) => d.delta > 0)
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 2)
    .map((d) => `${d.label} is up ${round1(d.delta)} points this week.`);
}

/** Top 2 negative deltas, most negative first. */
function computeSlipped(deltas: DeltaFixture[]): string[] {
  return deltas
    .filter((d) => d.delta < 0)
    .sort((a, b) => a.delta - b.delta)
    .slice(0, 2)
    .map((d) => `${d.label} is down ${round1(Math.abs(d.delta))} points this week.`);
}

/** The strongest correlation that contradicts its expected sign (moderate
 * or stronger, per the same ≥.35 threshold as the Correlations module),
 * or — when nothing contradicts expectations — the single largest-
 * magnitude delta as a "biggest mover" fallback. Never fabricates a
 * sentence when there's simply nothing to report. */
function computeSurprising(deltas: DeltaFixture[], correlations: CorrelationFixture[]): string {
  const contradicting = correlations
    .filter((c) => c.expectedSign !== 0 && Math.sign(c.r) !== 0 && Math.sign(c.r) !== c.expectedSign && Math.abs(c.r) >= SURPRISE_MIN_ABS_R)
    .sort((a, b) => Math.abs(b.r) - Math.abs(a.r));

  if (contradicting.length > 0) {
    const c = contradicting[0];
    return `${c.labelA} and ${c.labelB} moved opposite to what you'd expect this week (r=${round1(c.r)}).`;
  }

  if (deltas.length > 0) {
    const biggest = [...deltas].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))[0];
    return `${biggest.label} moved the most this week, ${biggest.delta >= 0 ? "up" : "down"} ${round1(Math.abs(biggest.delta))} points.`;
  }

  return "Nothing stood out this week.";
}

/** "Anchor the worst-adhered habit to the best-adhered one" — the
 * handoff's own stated default for the highest-leverage intervention.
 * Falls back to a generic prompt when there aren't at least two habits
 * with distinct adherence to pair up. */
function computeOneThing(habitAdherence: HabitAdherenceFixture[]): string {
  if (habitAdherence.length < 2) return "Keep logging — there's not enough data yet for a specific recommendation.";

  const sorted = [...habitAdherence].sort((a, b) => a.pct - b.pct);
  const worst = sorted[0];
  const best = sorted[sorted.length - 1];
  if (worst.pct === best.pct) return "Keep logging — there's not enough data yet for a specific recommendation.";

  return `Anchor ${worst.name} to ${best.name} — do them back-to-back so one reminds you of the other.`;
}

/**
 * The Weekly digest's four fixed slots, each a single generated sentence
 * — per the design_handoff_aayan README's "auto-drafted, not hand-
 * written" requirement. Pure: every input is whatever the caller already
 * computed (KPI deltas, correlation results, per-habit adherence) — see
 * lib/insights/data.ts's getWeeklyDigest for how those are assembled
 * from real data.
 */
export function computeWeeklyDigest(
  deltas: DeltaFixture[],
  correlations: CorrelationFixture[],
  habitAdherence: HabitAdherenceFixture[]
): WeeklyDigest {
  return {
    worked: computeWorked(deltas),
    slipped: computeSlipped(deltas),
    surprising: computeSurprising(deltas, correlations),
    oneThing: computeOneThing(habitAdherence),
  };
}

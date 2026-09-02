/** Matches the v2 handoff prototype's `correlate()` gate exactly (`if (n < 5)
 * return null` — gated on total n, not per-side; see
 * docs/adr/0005-v2-phase1-foundations-migration.md). */
export const CORRELATION_MIN_N = 5;

export type CorrelationStrength = "strong" | "moderate" | "weak";

/** Pearson's r over two equal-length numeric series. Null when the series
 * have fewer than 2 points, mismatched lengths, or either series has zero
 * variance (a constant series has no correlation to compute — the
 * formula would divide by zero). */
export function pearsonCorrelation(a: number[], b: number[]): number | null {
  if (a.length !== b.length || a.length < 2) return null;

  const n = a.length;
  const meanA = a.reduce((s, v) => s + v, 0) / n;
  const meanB = b.reduce((s, v) => s + v, 0) / n;

  let covariance = 0;
  let varianceA = 0;
  let varianceB = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    covariance += da * db;
    varianceA += da * da;
    varianceB += db * db;
  }

  if (varianceA === 0 || varianceB === 0) return null;
  return covariance / Math.sqrt(varianceA * varianceB);
}

/** Strong ≥ .6, Moderate ≥ .35, else Weak — per the design_handoff_aayan
 * README's Correlations spec, on the magnitude (direction doesn't affect
 * strength, only the claim's wording). */
export function correlationStrength(r: number): CorrelationStrength {
  const abs = Math.abs(r);
  if (abs >= 0.6) return "strong";
  if (abs >= 0.35) return "moderate";
  return "weak";
}

const STRENGTH_WORD: Record<CorrelationStrength, string> = { strong: "Strong", moderate: "Moderate", weak: "Weak" };

/** "<Strength> <positive/inverse> relationship between A and B." — a
 * plain-language claim from the computed r, not hand-written per pair. */
export function correlationClaim(labelA: string, labelB: string, r: number, strength: CorrelationStrength): string {
  const direction = r >= 0 ? "positive" : "inverse";
  return `${STRENGTH_WORD[strength]} ${direction} relationship between ${labelA} and ${labelB}.`;
}

/** The prototype's exact wording, kept verbatim per the ticket — the
 * epistemic caveat every correlation card must show. */
export const CORRELATION_CAVEAT =
  "Correlation is not cause, and N observations is thin. Treat this as a hypothesis worth two more weeks of deliberate logging, not a conclusion.";

export type CorrelationPair = {
  id: string;
  labelA: string;
  labelB: string;
  seriesA: number[];
  seriesB: number[];
  /** ISO date per paired observation, same length/order as the series —
   * optional since the pure math doesn't need it, but the drill-down
   * sheet's dated "Underlying entries" does (see lib/insights/data.ts's
   * getCorrelations, which is the only real caller that supplies it). */
  dates?: string[];
};

export type CorrelationResult = {
  id: string;
  labelA: string;
  labelB: string;
  r: number;
  n: number;
  strength: CorrelationStrength;
  claim: string;
  points: { x: number; y: number; date: string | null }[];
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Null (not a Weak card) when n < CORRELATION_MIN_N — the handoff is
 * explicit that a thin-n correlation should be suppressed entirely
 * rather than shown as a low-confidence Weak card, since "Weak, n=4"
 * reads as a real finding to a skimming eye.
 */
export function computeCorrelation(pair: CorrelationPair): CorrelationResult | null {
  const n = Math.min(pair.seriesA.length, pair.seriesB.length);
  if (n < CORRELATION_MIN_N) return null;

  const r = pearsonCorrelation(pair.seriesA, pair.seriesB);
  if (r === null) return null;

  const strength = correlationStrength(r);
  return {
    id: pair.id,
    labelA: pair.labelA,
    labelB: pair.labelB,
    r: round2(r),
    n,
    strength,
    claim: correlationClaim(pair.labelA, pair.labelB, r, strength),
    points: pair.seriesA.map((x, i) => ({ x, y: pair.seriesB[i], date: pair.dates?.[i] ?? null })),
  };
}

export function computeCorrelations(pairs: CorrelationPair[]): CorrelationResult[] {
  return pairs.map(computeCorrelation).filter((r): r is CorrelationResult => r !== null);
}

/** One numeric-valued Metric's dated entries (#187) — `date` is a plain
 * day-key string (e.g. "2026-08-21"), matching every other pair source in
 * lib/insights/data.ts's getCorrelations, so pairing here is a plain
 * string-keyed intersection rather than a second date-parsing scheme. */
export type MetricSeriesFixture = {
  id: string;
  name: string;
  entries: { date: string; value: number }[];
};

/**
 * Every unordered pair of Metrics, paired by shared date-key only (#187)
 * — a day either side didn't log is excluded from both series, not
 * defaulted to 0, same rule as every other pair getCorrelations builds.
 * O(metrics^2 * entries) is fine at this app's scale (a personal log, not
 * a multi-tenant dataset) — no attempt to prune the metric list before
 * pairing, since computeCorrelations' own n < CORRELATION_MIN_N gate
 * already suppresses anything too thin to be worth computing.
 */
export function generateMetricCorrelationPairs(metrics: MetricSeriesFixture[]): CorrelationPair[] {
  const pairs: CorrelationPair[] = [];
  for (let i = 0; i < metrics.length; i++) {
    for (let j = i + 1; j < metrics.length; j++) {
      const a = metrics[i];
      const b = metrics[j];
      const byDateB = new Map(b.entries.map((e) => [e.date, e.value]));
      const seriesA: number[] = [];
      const seriesB: number[] = [];
      const dates: string[] = [];
      for (const e of a.entries) {
        const bValue = byDateB.get(e.date);
        if (bValue === undefined) continue;
        seriesA.push(e.value);
        seriesB.push(bValue);
        dates.push(e.date);
      }
      if (seriesA.length === 0) continue;
      pairs.push({ id: `metric:${a.id}:${b.id}`, labelA: a.name, labelB: b.name, seriesA, seriesB, dates });
    }
  }
  return pairs;
}

/** As the number of logged Metrics grows, every-pair generation
 * (generateMetricCorrelationPairs) grows quadratically — an unbounded
 * wall of mostly-low-signal pairs would bury the few that matter. Capped
 * to the top N by |r| (magnitude, not raw sign) rather than a fixed |r|
 * threshold, so a handful of genuinely strong pairs are never hidden
 * just because nothing crossed an arbitrary cutoff, and a data-poor
 * period never shows an empty section when weaker pairs are all there
 * is. 8 is a deliberately generous "still fits on one screen" number, not
 * derived from any spec — #187's own call, documented here. */
export const CORRELATION_PAIR_CAP = 8;

export function capCorrelationsByMagnitude(results: CorrelationResult[], cap: number = CORRELATION_PAIR_CAP): CorrelationResult[] {
  return [...results].sort((a, b) => Math.abs(b.r) - Math.abs(a.r)).slice(0, cap);
}

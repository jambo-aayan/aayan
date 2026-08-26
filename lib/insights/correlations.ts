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

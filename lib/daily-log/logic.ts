export type StiffnessBucket = "UNDER_15" | "15_TO_30" | "30_TO_60" | "OVER_60";

/** Each bucket's representative midpoint (minutes) — what data.ts's
 * transitional shim reads back off the metric-stiffness MetricEntry's
 * numberValue, never the raw bucket (the old sheet form that wrote these
 * buckets is gone — see #184 — but the historical values it wrote still
 * need to round-trip back to a bucket for display). */
export const STIFFNESS_MIDPOINT: Record<StiffnessBucket, number> = {
  UNDER_15: 7,
  "15_TO_30": 22,
  "30_TO_60": 45,
  OVER_60: 75,
};

/** Inverse of STIFFNESS_MIDPOINT, for re-rendering the bucket a stored
 * value came from. Null for anything that isn't one of the four exact
 * stored midpoints. */
export function stiffnessBucketFromMidpoint(value: number): StiffnessBucket | null {
  const entry = (Object.entries(STIFFNESS_MIDPOINT) as [StiffnessBucket, number][]).find(
    ([, midpoint]) => midpoint === value
  );
  return entry ? entry[0] : null;
}

export type HeadacheLevel = "NONE" | "MILD" | "MODERATE" | "BAD";

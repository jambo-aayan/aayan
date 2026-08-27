export type StiffnessBucket = "UNDER_15" | "15_TO_30" | "30_TO_60" | "OVER_60";

/** Each bucket's representative midpoint (minutes) — what actually gets
 * stored on DailyLog.stiffness, never the raw bucket. See
 * docs/adr/0007-v2-phase3-daily-log-sheet.md: this keeps the numeric field,
 * the 14-day chart, the median and correlate() all unchanged while the
 * input itself stays a simple four-option pick. */
export const STIFFNESS_MIDPOINT: Record<StiffnessBucket, number> = {
  UNDER_15: 7,
  "15_TO_30": 22,
  "30_TO_60": 45,
  OVER_60: 75,
};

export function stiffnessMidpoint(bucket: StiffnessBucket): number {
  return STIFFNESS_MIDPOINT[bucket];
}

/** Inverse of stiffnessMidpoint, for re-rendering the bucket picker from a
 * stored value on edit. Null for anything that isn't one of the four exact
 * stored midpoints — DailyLog.stiffness should never hold another value,
 * but this stays honest about it rather than guessing a nearest bucket. */
export function stiffnessBucketFromMidpoint(value: number): StiffnessBucket | null {
  const entry = (Object.entries(STIFFNESS_MIDPOINT) as [StiffnessBucket, number][]).find(
    ([, midpoint]) => midpoint === value
  );
  return entry ? entry[0] : null;
}

export type HeadacheLevel = "NONE" | "MILD" | "MODERATE" | "BAD";

const HEADACHE_SEVERITY: Record<HeadacheLevel, number> = { NONE: 0, MILD: 1, MODERATE: 2, BAD: 3 };

/**
 * Headache tracks the day's worst value reached so far — a lower tap later
 * in the day is refused, not allowed to erase a bad morning (DATA_MODEL.md
 * §7). Returns whichever of the two is more severe; a tap that would lower
 * the stored value returns the current value unchanged. This is a silent
 * no-op, not an error (see ADR-0007) — the caller renders the control at
 * whatever this returns, without a toast explaining why it didn't move.
 */
export function applyHeadacheTap(current: HeadacheLevel, tapped: HeadacheLevel): HeadacheLevel {
  return HEADACHE_SEVERITY[tapped] > HEADACHE_SEVERITY[current] ? tapped : current;
}

export type DailyLogInput = {
  mood: number;
  stress: number;
  energy: number;
  sleepQuality: number;
  pain: number;
  headache: HeadacheLevel;
  stiffnessBucket: StiffnessBucket | null;
  weight: number | null;
  waist: number | null;
  bpSystolic: number | null;
  bpDiastolic: number | null;
};

export type ValidationResult = { ok: true } | { ok: false; error: string };

function isValidScale(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= 5;
}

/**
 * The sheet's full validation, in one place so the honesty rules can't
 * drift between the form and anywhere else that might construct a
 * DailyLogInput. mood/stress/energy/sleepQuality/pain/headache/stiffness
 * are required; weight/waist/bpSystolic/bpDiastolic are each independently
 * optional — entering one doesn't require the others. Refuses to save
 * without a stiffness bucket, since the charts read it (DATA_MODEL.md §7).
 */
export function validateDailyLogInput(input: DailyLogInput): ValidationResult {
  if (input.stiffnessBucket === null) {
    return { ok: false, error: "Pick how long you were stiff this morning before saving." };
  }
  if (!isValidScale(input.mood)) return { ok: false, error: "Mood must be 1-5." };
  if (!isValidScale(input.stress)) return { ok: false, error: "Stress must be 1-5." };
  if (!isValidScale(input.energy)) return { ok: false, error: "Energy must be 1-5." };
  if (!isValidScale(input.sleepQuality)) return { ok: false, error: "Sleep quality must be 1-5." };
  if (!isValidScale(input.pain)) return { ok: false, error: "Pain must be 1-5." };
  return { ok: true };
}

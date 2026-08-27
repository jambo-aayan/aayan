export type RatedStep = { rating: number | null; doneOn: Date | null };

export type RatingPoint = { date: Date; rating: number };

/** Rating-over-time chart — appears once a System has 2+ checkpoint
 * ratings (DATA_MODEL.md §5). Returns null below threshold rather than a
 * fabricated single-point trend. */
export function ratingTrend(steps: RatedStep[]): RatingPoint[] | null {
  const points = steps
    .filter((s): s is RatedStep & { rating: number; doneOn: Date } => s.rating !== null && s.doneOn !== null)
    .map((s) => ({ date: s.doneOn, rating: s.rating }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  return points.length >= 2 ? points : null;
}

export type RatingHistogram = { mean: number; spread: number; counts: Record<number, number> };

/** Rating histogram (mean + spread) — appears once a System has 5+
 * ratings. spread is the population standard deviation. */
export function ratingHistogram(steps: RatedStep[]): RatingHistogram | null {
  const ratings = steps.filter((s): s is RatedStep & { rating: number } => s.rating !== null).map((s) => s.rating);
  if (ratings.length < 5) return null;

  const mean = ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
  const variance = ratings.reduce((sum, r) => sum + (r - mean) ** 2, 0) / ratings.length;
  const counts: Record<number, number> = {};
  for (const r of ratings) counts[r] = (counts[r] ?? 0) + 1;

  return { mean, spread: Math.sqrt(variance), counts };
}

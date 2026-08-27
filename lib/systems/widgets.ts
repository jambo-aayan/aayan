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

export type MilestoneStep = { text: string; date: Date | null; done: boolean };

/** Milestone list — appears once a System has any dated milestones (1+),
 * per DATA_MODEL.md §5. Not gated further here; the Gantt/kanban upgrade
 * at 3+ is a separate widget (see #100). */
export function milestoneList(steps: MilestoneStep[]): MilestoneStep[] | null {
  const dated = steps.filter((s) => s.date !== null);
  return dated.length > 0 ? dated : null;
}

export type MeasureStep = { metricName: string | null; value: number | null; target: number | null; doneOn: Date | null };
export type MetricReading = { date: Date; value: number };

/** Numeric trend chart — appears once a System has 2+ readings of one
 * metric. Steps sharing a metricName form one series. */
export function numericTrend(steps: MeasureStep[], metricName: string): MetricReading[] | null {
  const readings = steps
    .filter((s): s is MeasureStep & { value: number; doneOn: Date } => s.metricName === metricName && s.value !== null && s.doneOn !== null)
    .map((s) => ({ date: s.doneOn, value: s.value }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  return readings.length >= 2 ? readings : null;
}

export type TargetGauge = { start: number; current: number; target: number };

/** Target gauge (start/current/target) — appears for a Measure step that
 * has a target. `start` is the earliest reading in the series, `current`
 * the latest. */
export function targetGauge(steps: MeasureStep[], metricName: string): TargetGauge | null {
  const readings = steps
    .filter((s): s is MeasureStep & { value: number; doneOn: Date } => s.metricName === metricName && s.value !== null && s.doneOn !== null)
    .sort((a, b) => a.doneOn.getTime() - b.doneOn.getTime());
  const withTarget = readings.find((s) => s.target !== null);
  if (readings.length === 0 || !withTarget) return null;

  return { start: readings[0].value, current: readings[readings.length - 1].value, target: withTarget.target! };
}

/** Small multiples — appears once a System has 2+ distinct metrics. */
export function distinctMetricNames(steps: MeasureStep[]): string[] | null {
  const names = [...new Set(steps.map((s) => s.metricName).filter((n): n is string => n !== null))];
  return names.length >= 2 ? names : null;
}

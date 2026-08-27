import { splitMean, type SplitMeanResult } from "../insights/split-mean";

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

export type PhotoStep = { photoUrl: string | null; doneOn: Date | null };
export type PhotoEntry = { url: string; date: Date };

/** Photo strip — appears once a System has 1+ photo. */
export function photoStrip(steps: PhotoStep[]): PhotoEntry[] | null {
  const photos = steps
    .filter((s): s is PhotoStep & { photoUrl: string; doneOn: Date } => s.photoUrl !== null && s.doneOn !== null)
    .map((s) => ({ url: s.photoUrl, date: s.doneOn }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  return photos.length > 0 ? photos : null;
}

export type ThenAndNow = { then: PhotoEntry; now: PhotoEntry };

/** Then-and-now pair (earliest vs latest) — appears once a System has 2+
 * photos. */
export function thenAndNow(steps: PhotoStep[]): ThenAndNow | null {
  const photos = photoStrip(steps);
  if (!photos || photos.length < 2) return null;
  return { then: photos[0], now: photos[photos.length - 1] };
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
 * per DATA_MODEL.md §5. Upgrades to a Gantt timeline (isGanttEligible) at
 * 3+, replacing this list rather than sitting alongside it. */
export function milestoneList(steps: MilestoneStep[]): MilestoneStep[] | null {
  const dated = steps.filter((s) => s.date !== null);
  return dated.length > 0 ? dated : null;
}

/** The milestone list upgrades to a Gantt-style timeline with a now-line
 * once 3+ dated milestones exist — replacing the plain list, not adding
 * alongside it. A kanban board toggles from the same underlying data. */
export function isGanttEligible(milestones: MilestoneStep[]): boolean {
  return milestones.length >= 3;
}

export type KanbanColumn = "NOT_STARTED" | "IN_PROGRESS" | "DONE";

/** Kanban classification for a dated milestone: done wins outright;
 * otherwise "in progress" once its date has arrived, "not started" while
 * it's still in the future. */
export function kanbanColumn(milestone: MilestoneStep, today: Date): KanbanColumn {
  if (milestone.done) return "DONE";
  if (milestone.date !== null && milestone.date.getTime() <= today.getTime()) return "IN_PROGRESS";
  return "NOT_STARTED";
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

export type StreakDay = { date: Date; done: boolean };

/** 90-day streak grid (schedule-aware) — appears once a System has a
 * Repeating step. `occurrences` are the logged dates within the window;
 * the grid marks each day of the last 90 as done/not, same shape as a
 * habit's check-in grid. */
const GRID_DAY_MS = 24 * 60 * 60 * 1000;

function midnight(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** `today` and `occurrences` are normalized to midnight UTC before
 * comparing — `occurrences` come from a `@db.Date` column (already
 * midnight), but `today` is typically `new Date()`, full-precision, and
 * would otherwise never match. */
export function streakGrid(occurrences: Date[], today: Date, days = 90): StreakDay[] {
  const doneDates = new Set(occurrences.map((d) => midnight(d).getTime()));
  const todayMidnight = midnight(today);
  const grid: StreakDay[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(todayMidnight.getTime() - i * GRID_DAY_MS);
    grid.push({ date, done: doneDates.has(date.getTime()) });
  }
  return grid;
}

/** Rating-vs-adherence scatter — appears once a System has 5+ ratings and
 * a linked habit. Reuses lib/insights/split-mean.ts's n>=3-per-side gate
 * directly rather than a new correlation algorithm; checkpoint ratings
 * are timestamped the same shape ({date, value}[]) that CorrelationView
 * already consumes for pain-vs-habit. */
export function ratingVsAdherence(ratedSteps: RatedStep[], habitCheckInDates: Date[]): SplitMeanResult | null {
  const points = ratedSteps.filter(
    (s): s is RatedStep & { rating: number; doneOn: Date } => s.rating !== null && s.doneOn !== null
  );
  if (points.length < 5) return null;

  return splitMean(
    points.map((p) => ({ date: p.doneOn, value: p.rating })),
    habitCheckInDates
  );
}

export type OccurrenceStatusCounts = { onTime: number; late: number; skipped: number };

/** Cadence-adherence breakdown — appears once 3+ occurrences are logged
 * (loggedCount is the real SystemStepOccurrence row count, not derived
 * from `statuses`, since a SKIPPED window has no logged row at all). */
export function adherenceBreakdown(
  statuses: ("ON_TIME" | "LATE" | "SKIPPED")[],
  loggedCount: number
): OccurrenceStatusCounts | null {
  if (loggedCount < 3) return null;

  return {
    onTime: statuses.filter((s) => s === "ON_TIME").length,
    late: statuses.filter((s) => s === "LATE").length,
    skipped: statuses.filter((s) => s === "SKIPPED").length,
  };
}

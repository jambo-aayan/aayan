const DAY_MS = 24 * 60 * 60 * 1000;
const PROJECTION_MAX_DAYS = 365 * 3;

export type TrajectoryPoint = { date: string; value: number };

export type TrajectoryResult = {
  currentValue: number;
  /** Daily forward-projected points at the current pace, from `asOf` up
   * to whichever comes first: reaching target, or PROJECTION_MAX_DAYS out
   * (a flat/negative pace would otherwise project forever). */
  projection: TrajectoryPoint[];
  /** Null when the pace is flat or negative and the target hasn't been
   * reached yet — there's no future date to report, not an error. */
  projectedDate: string | null;
  /** projectedDate minus deadline, in days (positive = late, negative =
   * early). Null when there's no projectedDate, or no deadline to
   * compare against. */
  deltaVsDeadlineDays: number | null;
  writtenRead: string;
};

function parseDate(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

/** Average daily rate of change across the observed actuals — the
 * simplest honest "current pace," not a full least-squares regression
 * (first-vs-last is easy to explain in the written read and matches what
 * a person means by "at this pace" better than a fitted line would for a
 * short, noisy series). Null when there are fewer than 2 points (nothing
 * to compute a rate from). */
function dailyPace(actuals: TrajectoryPoint[]): number | null {
  if (actuals.length < 2) return null;
  const first = actuals[0];
  const last = actuals[actuals.length - 1];
  const days = (parseDate(last.date).getTime() - parseDate(first.date).getTime()) / DAY_MS;
  if (days <= 0) return null;
  return (last.value - first.value) / days;
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Projects the actuals series forward at its current daily pace until it
 * reaches `target` (or PROJECTION_MAX_DAYS out, whichever is sooner), and
 * compares the projected arrival date against `deadline`. Pure: `actuals`
 * is whatever the caller already resolved as the historical value series
 * (see lib/insights/data.ts's getTrajectory for how that's approximated
 * from real data, since there's no logged net-worth history to read
 * directly).
 */
export function computeTrajectory(actuals: TrajectoryPoint[], target: number, deadline: Date | null, asOf: Date): TrajectoryResult {
  const currentValue = actuals.length > 0 ? actuals[actuals.length - 1].value : 0;
  const pace = dailyPace(actuals);

  if (currentValue >= target) {
    return {
      currentValue,
      projection: [{ date: formatDate(asOf), value: currentValue }],
      projectedDate: formatDate(asOf),
      deltaVsDeadlineDays: deadline ? Math.round((asOf.getTime() - deadline.getTime()) / DAY_MS) : null,
      writtenRead: "Already at target.",
    };
  }

  if (pace === null || pace <= 0) {
    return {
      currentValue,
      projection: [],
      projectedDate: null,
      deltaVsDeadlineDays: null,
      writtenRead: "At the current pace, this won't reach target — the constraint is pace, not distance left to cover.",
    };
  }

  const daysNeeded = Math.min(PROJECTION_MAX_DAYS, Math.ceil((target - currentValue) / pace));
  const projection: TrajectoryPoint[] = [];
  for (let d = 0; d <= daysNeeded; d += Math.max(1, Math.floor(daysNeeded / 20))) {
    projection.push({ date: formatDate(new Date(asOf.getTime() + d * DAY_MS)), value: currentValue + pace * d });
  }
  const projectedDateObj = new Date(asOf.getTime() + daysNeeded * DAY_MS);
  const projectedDate = formatDate(projectedDateObj);

  let deltaVsDeadlineDays: number | null = null;
  let writtenRead: string;
  if (daysNeeded >= PROJECTION_MAX_DAYS) {
    writtenRead = "At the current pace, this won't reach target within a reasonable horizon — the constraint is pace.";
  } else if (!deadline) {
    writtenRead = `On pace to reach target by ${projectedDate}. No deadline set to compare against.`;
  } else {
    deltaVsDeadlineDays = Math.round((projectedDateObj.getTime() - deadline.getTime()) / DAY_MS);
    if (deltaVsDeadlineDays <= 0) {
      writtenRead = `On pace to arrive ${Math.abs(deltaVsDeadlineDays)} day${Math.abs(deltaVsDeadlineDays) === 1 ? "" : "s"} early.`;
    } else {
      writtenRead = `On pace to arrive ${deltaVsDeadlineDays} day${deltaVsDeadlineDays === 1 ? "" : "s"} late — the constraint is pace, not distance left to cover.`;
    }
  }

  return { currentValue, projection, projectedDate, deltaVsDeadlineDays, writtenRead };
}

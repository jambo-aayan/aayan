import { mondayOf } from "../habits/streak";

export type Trend = "UP" | "DOWN" | "SAME";

/** Average of values whose date falls in the Mon-Sun week starting weekStart. Reuses the
 * already-correct mondayOf week math rather than re-deriving week boundaries. */
export function weeklyAverage(logs: { date: Date; value: number }[], weekStart: Date): number | null {
  const start = mondayOf(weekStart).getTime();
  const inWeek = logs.filter((l) => mondayOf(l.date).getTime() === start);
  if (inWeek.length === 0) return null;
  return inWeek.reduce((sum, l) => sum + l.value, 0) / inWeek.length;
}

export function weekTrend(currentAvg: number | null, priorAvg: number | null): Trend | null {
  if (currentAvg === null || priorAvg === null) return null;
  if (currentAvg > priorAvg) return "UP";
  if (currentAvg < priorAvg) return "DOWN";
  return "SAME";
}

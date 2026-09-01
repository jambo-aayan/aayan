import type { VisualWithRecords } from "./actions";

type Record = VisualWithRecords["records"][number];

export type DateValuePoint = { date: Date; value: number };

/** Line/Bar/Streak heatmap all read the same date+yValue shape off a
 * Visual's ad-hoc records (#164) — this is that shared read, sorted
 * chronologically, with any record missing either field dropped (a
 * Scatter-only xValue/xLabel-only row, or a not-yet-fully-filled-in one,
 * should never show up as a broken point on one of these three chart
 * types). Pure — no Prisma/React — so it's directly unit-testable. */
export function dateValuePoints(records: Record[]): DateValuePoint[] {
  return records
    .filter((r): r is Record & { date: Date; yValue: number } => r.date !== null && r.yValue !== null)
    .map((r) => ({ date: r.date, value: r.yValue }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

/** Progress bar (#164) reads only the latest record's value as "current" —
 * null when there's no data yet, so the caller can render a 0/empty state
 * rather than treating "no data" the same as "current is 0". */
export function latestValue(records: Record[]): number | null {
  const points = dateValuePoints(records);
  return points.length === 0 ? null : points[points.length - 1].value;
}

export type HeatmapCell = DateValuePoint & { intensity: number };

/** Streak heatmap (#164) — min-max normalizes each point's value into a
 * 0-1 intensity for shading, so the darkest cell is always the highest
 * value in view rather than needing a fixed absolute scale. A single
 * distinct value across every point (including just one point total)
 * shades everything at full intensity — nothing to compare against yet,
 * not "everything is the minimum". */
export function heatmapIntensities(records: Record[]): HeatmapCell[] {
  const points = dateValuePoints(records);
  if (points.length === 0) return [];
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) return points.map((p) => ({ ...p, intensity: 1 }));
  return points.map((p) => ({ ...p, intensity: (p.value - min) / (max - min) }));
}

export type ScatterPoint = { x: number; y: number };

/** Scatter's own shape — xValue+yValue, no date (#164). */
export function scatterPoints(records: Record[]): ScatterPoint[] {
  return records
    .filter((r): r is Record & { xValue: number; yValue: number } => r.xValue !== null && r.yValue !== null)
    .map((r) => ({ x: r.xValue, y: r.yValue }));
}

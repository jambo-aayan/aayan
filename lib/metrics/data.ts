import "server-only";
import { prisma } from "@/lib/prisma";

/** Every non-archived Metric, sorted for display — the generic Log tab
 * (#184) and metric-management UI (#183) both read off this. */
export async function getMetrics() {
  return prisma.metric.findMany({ where: { archivedAt: null }, orderBy: { sortOrder: "asc" } });
}

export async function getMetric(id: string) {
  return prisma.metric.findUnique({ where: { id } });
}

/** A Metric's full logged history, oldest first — feeds the history/trend
 * view (#185), same unbounded shape as lib/pain-mobility/data.ts's own
 * getPainMobilityLogs (narrowing to a window is a display-layer concern,
 * not this query's job). */
export async function getMetricEntries(metricId: string) {
  return prisma.metricEntry.findMany({ where: { metricId }, orderBy: { date: "asc" } });
}

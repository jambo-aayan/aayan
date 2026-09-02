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

/** Every Pillar/Area, for the metric-management form's scope picker
 * (#183) — same shape as lib/tasks/data.ts's own getPillarOptions/
 * getAreaOptions, not reused directly since that module isn't meant to be
 * a shared "every picker in the app" dependency; a metric's scope picker
 * is different enough a use case (optional, "Global" is a real choice
 * here) to warrant its own small query rather than importing tasks'. */
export async function getMetricScopeOptions() {
  const [pillars, areas] = await Promise.all([
    prisma.pillar.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.area.findMany({ select: { id: true, name: true, pillarId: true }, orderBy: { sortOrder: "asc" } }),
  ]);
  return { pillars, areas };
}

import "server-only";
import { prisma } from "@/lib/prisma";
import { getPillarOptions, getAreaOptions } from "@/lib/tasks/data";
import { currentPeriodStart } from "./due";

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
 * (#183) — reuses lib/tasks/data.ts's existing getPillarOptions/
 * getAreaOptions (byte-identical shape to what was here before) rather
 * than a parallel query, per review feedback on the earlier duplication. */
export async function getMetricScopeOptions() {
  const [pillars, areas] = await Promise.all([getPillarOptions(), getAreaOptions()]);
  return { pillars, areas };
}

/** Every non-archived Metric, each paired with its current period's
 * MetricEntry if one exists (#184) — a DAILY metric's "current period" is
 * today, a WEEKLY metric's is this calendar week (Monday-anchored), an
 * AD_HOC metric has no period at all (currentEntry is always null for
 * one — see currentPeriodStart's own doc comment), so the Log tab always
 * shows it as a fresh entry control rather than a persisted current
 * value. Two lookup queries total regardless of how many metrics exist —
 * one for every DAILY metric's entry at today's date, one for every
 * WEEKLY metric's entry at this week's Monday. */
export async function getMetricsForLog(now: Date = new Date()) {
  const metrics = await prisma.metric.findMany({ where: { archivedAt: null }, orderBy: { sortOrder: "asc" } });

  const dailyIds = metrics.filter((m) => m.cadence === "DAILY").map((m) => m.id);
  const weeklyIds = metrics.filter((m) => m.cadence === "WEEKLY").map((m) => m.id);
  const dailyStart = currentPeriodStart("DAILY", now)!;
  const weeklyStart = currentPeriodStart("WEEKLY", now)!;

  const entries =
    dailyIds.length === 0 && weeklyIds.length === 0
      ? []
      : await prisma.metricEntry.findMany({
          where: {
            OR: [
              ...(dailyIds.length > 0 ? [{ metricId: { in: dailyIds }, date: dailyStart }] : []),
              ...(weeklyIds.length > 0 ? [{ metricId: { in: weeklyIds }, date: weeklyStart }] : []),
            ],
          },
        });
  const entryByMetricId = new Map(entries.map((e) => [e.metricId, e]));

  return metrics.map((m) => ({
    ...m,
    currentEntry: entryByMetricId.get(m.id) ?? null,
    periodStart: m.cadence === "AD_HOC" ? null : m.cadence === "DAILY" ? dailyStart : weeklyStart,
  }));
}

export type MetricForLog = Awaited<ReturnType<typeof getMetricsForLog>>[number];

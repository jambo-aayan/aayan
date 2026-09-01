import "server-only";
import { prisma } from "@/lib/prisma";
import { parseChartBinding } from "./config";

/** Every eligible chart for Home's "Log today" widget (#170, ADR-0017) —
 * every ad-hoc (unbound), date-based Line/Bar/Streak heatmap chart across
 * ALL Pillars/Areas, not scoped to one page the way getVisualsForPillar/
 * Area are — the whole point is not having to navigate to a chart's own
 * page just to log today's value. Progress bar and Scatter are excluded
 * at the query level (neither fits "one value per day" — Progress bar
 * has its own target-relative shape, Scatter needs two numbers); a bound
 * chart of the three eligible types is excluded afterward via
 * parseChartBinding, since there's nothing to manually log for one (the
 * same reasoning date-series-chart-visual.tsx/streak-heatmap-visual.tsx
 * already apply to hide their own entry forms when bound). */
export async function getLogTodayCharts() {
  const visuals = await prisma.visual.findMany({
    where: { type: { in: ["LINE", "BAR", "STREAK_HEATMAP"] } },
    include: {
      records: { orderBy: { date: "asc" } },
      pillar: { select: { name: true } },
      area: { select: { name: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  return visuals.filter((v) => parseChartBinding(v.config) === null);
}

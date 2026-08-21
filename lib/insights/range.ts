export const INSIGHTS_RANGES = [
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
  { value: "90d", label: "90d" },
  { value: "year", label: "Year" },
] as const;

export type InsightsRange = (typeof INSIGHTS_RANGES)[number]["value"];

export const DEFAULT_INSIGHTS_RANGE: InsightsRange = "30d";

/** Validates a raw `?range=` search param against the known values,
 * falling back to the default for anything else (missing, mistyped, or a
 * stale link). Later Insights modules read the resolved value from here
 * rather than re-validating their own copy. */
export function parseInsightsRange(raw: string | string[] | undefined): InsightsRange {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return INSIGHTS_RANGES.some((r) => r.value === value) ? (value as InsightsRange) : DEFAULT_INSIGHTS_RANGE;
}

const RANGE_DAYS: Record<InsightsRange, number> = { "7d": 7, "30d": 30, "90d": 90, year: 365 };

const DAY_MS = 24 * 60 * 60 * 1000;

function utcMidnight(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** The current window for a range value (inclusive, ending on `asOf`) and
 * the equal-length window immediately before it — every KPI/module that
 * "responds to the range control" (per the Insights header's own
 * instruction) is computed over these two windows. */
export function insightsWindows(range: InsightsRange, asOf: Date): { current: [Date, Date]; previous: [Date, Date] } {
  const days = RANGE_DAYS[range];
  const currentEnd = utcMidnight(asOf);
  const currentStart = new Date(currentEnd.getTime() - (days - 1) * DAY_MS);
  const previousEnd = new Date(currentStart.getTime() - DAY_MS);
  const previousStart = new Date(previousEnd.getTime() - (days - 1) * DAY_MS);
  return { current: [currentStart, currentEnd], previous: [previousStart, previousEnd] };
}

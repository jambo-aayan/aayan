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

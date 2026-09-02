import { mondayOf } from "../habits/streak";
import { utcMidnight } from "../habits/date-utils";

export type MetricCadence = "DAILY" | "WEEKLY" | "AD_HOC";

/** The start of a Metric's current logging period, given its cadence and
 * "now" (#184, reused by #186's nudge eligibility) — DAILY periods start
 * at midnight, WEEKLY at that calendar week's Monday (matching
 * lib/nudges/eligibility.ts's own isoWeekKey convention). AD_HOC has no
 * period at all — always loggable, never "due" — null signals that,
 * distinct from a real Date. */
export function currentPeriodStart(cadence: MetricCadence, now: Date): Date | null {
  if (cadence === "DAILY") return utcMidnight(now);
  if (cadence === "WEEKLY") return mondayOf(now);
  return null;
}

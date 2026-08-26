import { utcMidnight } from "../habits/date-utils";

export const SPLIT_MEAN_MIN_DAYS_PER_SIDE = 3;

export type DailyLog = { date: Date; value: number };

export type SplitMeanResult =
  | { ready: false; sampleSize: number }
  | {
      ready: true;
      trueAvg: number;
      falseAvg: number;
      trueDays: number;
      falseDays: number;
    };

/**
 * Mean-split of any paired daily series: average `value` on days a boolean
 * predicate held (`predicateDates`) vs. days it didn't. Generalized out of
 * lib/pain-mobility/ — originally pain-vs-habit-checkin only, now usable for
 * any daily metric against any predicate (sleep vs. stiffness, trained vs.
 * mood, etc. — see docs/adr/0005-v2-phase1-foundations-migration.md).
 *
 * Deliberately conservative: requires at least SPLIT_MEAN_MIN_DAYS_PER_SIDE
 * logged days on both sides before returning anything comparable — never
 * enough data shouldn't quietly render a misleading two-data-point "trend."
 */
export function splitMean(logs: DailyLog[], predicateDates: Date[]): SplitMeanResult {
  const predicateDays = new Set(predicateDates.map((d) => utcMidnight(d).getTime()));

  const trueLogs = logs.filter((l) => predicateDays.has(utcMidnight(l.date).getTime()));
  const falseLogs = logs.filter((l) => !predicateDays.has(utcMidnight(l.date).getTime()));

  if (trueLogs.length < SPLIT_MEAN_MIN_DAYS_PER_SIDE || falseLogs.length < SPLIT_MEAN_MIN_DAYS_PER_SIDE) {
    return { ready: false, sampleSize: logs.length };
  }

  const average = (entries: DailyLog[]) => entries.reduce((sum, l) => sum + l.value, 0) / entries.length;

  return {
    ready: true,
    trueAvg: average(trueLogs),
    falseAvg: average(falseLogs),
    trueDays: trueLogs.length,
    falseDays: falseLogs.length,
  };
}

import { utcMidnight } from "../habits/date-utils";

const MIN_DAYS_PER_SIDE = 3;

export type PainLog = { date: Date; pain: number };

export type CorrelationResult =
  | { ready: false; sampleSize: number }
  | {
      ready: true;
      habitDoneAvgPain: number;
      habitNotDoneAvgPain: number;
      habitDoneDays: number;
      habitNotDoneDays: number;
    };

/**
 * Deliberately conservative: requires at least MIN_DAYS_PER_SIDE logged pain
 * days on both sides (habit done vs not done) before returning anything
 * comparable — never enough data shouldn't quietly render a misleading
 * two-data-point "trend." Always present this as something to raise with a
 * clinician, never a diagnosis.
 */
export function correlate(painLogs: PainLog[], habitCheckInDates: Date[]): CorrelationResult {
  const checkInDays = new Set(habitCheckInDates.map((d) => utcMidnight(d).getTime()));

  const doneDays = painLogs.filter((l) => checkInDays.has(utcMidnight(l.date).getTime()));
  const notDoneDays = painLogs.filter((l) => !checkInDays.has(utcMidnight(l.date).getTime()));

  if (doneDays.length < MIN_DAYS_PER_SIDE || notDoneDays.length < MIN_DAYS_PER_SIDE) {
    return { ready: false, sampleSize: painLogs.length };
  }

  const average = (logs: PainLog[]) => logs.reduce((sum, l) => sum + l.pain, 0) / logs.length;

  return {
    ready: true,
    habitDoneAvgPain: average(doneDays),
    habitNotDoneAvgPain: average(notDoneDays),
    habitDoneDays: doneDays.length,
    habitNotDoneDays: notDoneDays.length,
  };
}

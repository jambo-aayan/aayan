export type Frequency = "DAILY" | "WEEKLY";

const DAY_MS = 24 * 60 * 60 * 1000;
const ESTABLISHED_DAYS = 7;
const ESTABLISHED_WEEKS = 4;

/**
 * The Monday (UTC midnight) of the ISO week containing `date`. Deliberately
 * not a naive floor(epochDays / 7) bucket — that doesn't align to real
 * Mon-Sun weeks (epoch day 0 was a Thursday), which previously let a
 * Saturday and the immediately following Sunday land in different "weeks".
 */
export function mondayOf(date: Date): Date {
  const utcMidnight = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const day = new Date(utcMidnight).getUTCDay(); // 0=Sun..6=Sat
  const daysSinceMonday = day === 0 ? 6 : day - 1;
  return new Date(utcMidnight - daysSinceMonday * DAY_MS);
}

function uniqueSortedDescending(keys: number[]): number[] {
  return [...new Set(keys)].sort((a, b) => b - a);
}

/** Consecutive calendar days checked in, counting back from the most recent. */
export function dailyStreak(dates: Date[]): number {
  if (dates.length === 0) return 0;

  const dayKeys = dates.map((d) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const sorted = uniqueSortedDescending(dayKeys);

  let streak = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i - 1] - sorted[i] === DAY_MS) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

/** Consecutive Mon-Sun weeks with >=1 check-in, counting back from the most recent. */
export function weeklyStreak(dates: Date[]): number {
  if (dates.length === 0) return 0;

  const weekKeys = dates.map((d) => mondayOf(d).getTime());
  const sorted = uniqueSortedDescending(weekKeys);

  const WEEK_MS = 7 * DAY_MS;
  let streak = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i - 1] - sorted[i] === WEEK_MS) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

export function isEstablished(streak: number, frequency: Frequency): boolean {
  return frequency === "DAILY" ? streak >= ESTABLISHED_DAYS : streak >= ESTABLISHED_WEEKS;
}

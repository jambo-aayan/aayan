const DAY_MS = 24 * 60 * 60 * 1000;

/** Step 1's "Next week" pill: +7 days from *today* (the review date), not
 * from the task's old due date — a task overdue by a month doesn't get
 * pushed a month and a week out, it gets a clean slate one week from now. */
export function nextWeekDueDate(today: Date): Date {
  return new Date(today.getTime() + 7 * DAY_MS);
}

export type StalenessBucket = "Overdue" | "Today" | "Tomorrow" | "This week" | "No date";

const BUCKET_ORDER: StalenessBucket[] = ["Overdue", "Today", "Tomorrow", "This week", "No date"];

function utcMidnight(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** Overdue → Today → Tomorrow → This week (next 2-7 days) → No date, per
 * the design_handoff_aayan README's Step 1 spec. */
export function stalenessBucket(dueDate: Date | null, today: Date): StalenessBucket {
  if (!dueDate) return "No date";
  const t = utcMidnight(today).getTime();
  const d = utcMidnight(dueDate).getTime();
  const daysAway = Math.round((d - t) / DAY_MS);
  if (daysAway < 0) return "Overdue";
  if (daysAway === 0) return "Today";
  if (daysAway === 1) return "Tomorrow";
  if (daysAway <= 7) return "This week";
  return "No date";
}

export function bucketRank(bucket: StalenessBucket): number {
  return BUCKET_ORDER.indexOf(bucket);
}

/** Sorted by staleness bucket, oldest/most-overdue first within each
 * bucket. Does not cap the list — callers slice to the top N themselves
 * (Step 1 shows max 5). */
export function sortByStaleness<T extends { dueDate: Date | null }>(tasks: T[], today: Date): T[] {
  return [...tasks].sort((a, b) => {
    const bucketDiff = bucketRank(stalenessBucket(a.dueDate, today)) - bucketRank(stalenessBucket(b.dueDate, today));
    if (bucketDiff !== 0) return bucketDiff;
    const aTime = a.dueDate?.getTime() ?? 0;
    const bTime = b.dueDate?.getTime() ?? 0;
    return aTime - bTime;
  });
}

/** Step 3's "top three become next week's My Day defaults" — a plain
 * slice, pulled out as its own function so the "top 3" rule has one
 * place to change and one place to test. */
export function topThree<T>(ordered: T[]): T[] {
  return ordered.slice(0, 3);
}

/**
 * Reconciles a freshly-fetched candidate id list against a persisted
 * rank order: ids already in the saved order keep their relative
 * position; brand-new candidates (e.g. a task created since the review
 * started) are appended at the end; ids no longer in the candidate set
 * (completed/deleted since) are dropped. Pure merge logic — the actual
 * persistence is a DB write in lib/weekly-review/actions.ts.
 */
export function reconcileRankOrder(savedOrder: string[], candidateIds: string[]): string[] {
  const candidateSet = new Set(candidateIds);
  const kept = savedOrder.filter((id) => candidateSet.has(id));
  const keptSet = new Set(kept);
  const added = candidateIds.filter((id) => !keptSet.has(id));
  return [...kept, ...added];
}

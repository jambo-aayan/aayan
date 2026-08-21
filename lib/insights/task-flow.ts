const DAY_MS = 24 * 60 * 60 * 1000;
export const TASK_FLOW_WEEKS = 8;

export type TaskFlowFixture = {
  createdAt: Date;
  dueDate: Date | null;
  completedAt: Date | null;
};

export type WeekBar = { weekStart: string; created: number; closed: number };

function inRange(date: Date, start: Date, end: Date): boolean {
  return date.getTime() >= start.getTime() && date.getTime() < end.getTime();
}

/** One paired bar per week over TASK_FLOW_WEEKS weeks: created (by
 * createdAt) vs. closed (by completedAt) — independent counts, so a task
 * created in an earlier week and closed this week counts toward this
 * week's "closed" bar, not its own creation week's. `weekStarts` are
 * Monday-anchored, oldest first, exactly TASK_FLOW_WEEKS of them. */
export function computeTaskFlowWeeks(tasks: TaskFlowFixture[], weekStarts: Date[]): WeekBar[] {
  return weekStarts.map((weekStart) => {
    const weekEnd = new Date(weekStart.getTime() + 7 * DAY_MS);
    return {
      weekStart: weekStart.toISOString().slice(0, 10),
      created: tasks.filter((t) => inRange(t.createdAt, weekStart, weekEnd)).length,
      closed: tasks.filter((t) => t.completedAt && inRange(t.completedAt, weekStart, weekEnd)).length,
    };
  });
}

/** % of tasks due within [windowStart, windowEnd) that are still not
 * closed as of `asOf` — the backlog that rolled past the week it was due
 * rather than getting resolved in it. Tasks with no due date don't have
 * a week to carry over *from*, so they're excluded from both sides of
 * the ratio. */
export function computeCarryOverRate(tasks: TaskFlowFixture[], windowStart: Date, windowEnd: Date, asOf: Date): number {
  const dueInWindow = tasks.filter((t) => t.dueDate && inRange(t.dueDate, windowStart, windowEnd));
  if (dueInWindow.length === 0) return 0;
  const stillOpen = dueInWindow.filter((t) => !t.completedAt || t.completedAt.getTime() > asOf.getTime()).length;
  return Math.round((stillOpen / dueInWindow.length) * 100);
}

/** Median age in days (createdAt -> asOf) across every currently-open
 * task — a snapshot of the backlog, not scoped to any particular week.
 * Null when there are no open tasks (nothing to take a median of). */
export function computeMedianOpenTaskAge(openTasks: { createdAt: Date }[], asOf: Date): number | null {
  if (openTasks.length === 0) return null;
  const ages = openTasks.map((t) => Math.floor((asOf.getTime() - t.createdAt.getTime()) / DAY_MS)).sort((a, b) => a - b);
  const mid = Math.floor(ages.length / 2);
  return ages.length % 2 === 0 ? Math.round((ages[mid - 1] + ages[mid]) / 2) : ages[mid];
}

/** % of *closed* tasks (that had a due date) closed on or before it —
 * tasks with no due date, or still open, aren't part of this ratio
 * either way (there's no "on time" to judge without a due date, and an
 * open task hasn't been closed yet at all). */
export function computeOnTimeCloseRate(tasks: TaskFlowFixture[]): number {
  const closedWithDue = tasks.filter((t) => t.completedAt && t.dueDate);
  if (closedWithDue.length === 0) return 0;
  const onTime = closedWithDue.filter((t) => t.completedAt!.getTime() <= t.dueDate!.getTime()).length;
  return Math.round((onTime / closedWithDue.length) * 100);
}

export type TaskFlowSummary = {
  weeks: WeekBar[];
  carryOverRate: number;
  medianOpenTaskAgeDays: number | null;
  onTimeCloseRate: number;
};

export function computeTaskFlow(
  windowTasks: TaskFlowFixture[],
  openTasks: { createdAt: Date }[],
  weekStarts: Date[],
  asOf: Date
): TaskFlowSummary {
  const windowStart = weekStarts[0];
  const windowEnd = new Date(weekStarts[weekStarts.length - 1].getTime() + 7 * DAY_MS);
  return {
    weeks: computeTaskFlowWeeks(windowTasks, weekStarts),
    carryOverRate: computeCarryOverRate(windowTasks, windowStart, windowEnd, asOf),
    medianOpenTaskAgeDays: computeMedianOpenTaskAge(openTasks, asOf),
    onTimeCloseRate: computeOnTimeCloseRate(windowTasks),
  };
}

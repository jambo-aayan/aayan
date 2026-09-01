import { doneEarlierThisWeek, expectedCount, habitOccursOn, type HabitSchedule } from "../habits/schedule";
import { utcMidnight } from "../habits/date-utils";
import { isRealSpend } from "../finance/logic";

const DAY_MS = 24 * 60 * 60 * 1000;
const WINDOW_DAYS = 28;
const HISTORY_BARS = 12;

/** The three inputs behind the Momentum score, and their fixed weights —
 * per the design_handoff_aayan README's Insights spec: "a score nobody can
 * explain gets ignored", so these are surfaced in the UI, not just used. */
export const MOMENTUM_WEIGHTS = { adherence: 0.5, followThrough: 0.3, surplusRate: 0.2 } as const;

export type HabitFixture = { id: string; schedule: HabitSchedule };
export type CheckInFixture = { habitId: string; date: Date; level: "FULL" | "MINIMUM" };
export type TaskFixture = { dueDate: Date; completedAt: Date | null };
export type TransactionFixture = {
  date: Date;
  amount: number;
  direction: "IN" | "OUT";
  /** A transaction flagged as a receivable or a goal contribution is a
   * reclassification, not real income/spend — excluded here the same
   * way lib/finance/category-breakdown.ts's categoryBreakdown and
   * budgetVsActual already exclude both (ADR-0010/#114/#120). */
  receivableId: string | null;
  goalContributionId: string | null;
};

export type MomentumInputs = {
  habits: HabitFixture[];
  checkIns: CheckInFixture[];
  tasks: TaskFixture[];
  transactions: TransactionFixture[];
};

export type MomentumMetrics = {
  score: number;
  adherence: number;
  followThrough: number;
  surplusRate: number;
};

export function eachDay(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  for (let t = start.getTime(); t <= end.getTime(); t += DAY_MS) days.push(new Date(t));
  return days;
}

export function inRange(date: Date, start: Date, end: Date): boolean {
  return date.getTime() >= start.getTime() && date.getTime() <= end.getTime();
}

/** logged/scheduled for one habit over [start, end] inclusive — the unit
 * computeAdherence sums across every habit, and lib/insights/kpis.ts reuses
 * directly for its per-habit adherence breakdown (naming the weakest
 * habit in a KPI card's diagnosis line needs the same math per-habit,
 * not just the aggregate).
 *
 * `scheduled` comes from expectedCount — the schedule engine's single
 * source of truth (see docs/adr/0006-v2-phase2-habits-tasks.md and
 * lib/insights/consistency.ts's identical treatment) — not a second,
 * separately-accumulated count. For every non-PER_WEEK type this is
 * identical to counting habitOccursOn-true days directly; for PER_WEEK
 * it's the proportional round(days/7 * target) rather than treating the
 * habit as due every calendar day. `logged` stays a per-day accumulation
 * (not doneCount) so MINIMUM check-ins keep their 0.5 partial credit,
 * which a plain presence count can't model. */
export function adherenceForHabit(
  habit: HabitFixture,
  checkIns: CheckInFixture[],
  start: Date,
  end: Date
): { scheduled: number; logged: number } {
  const habitCheckIns = checkIns.filter((c) => c.habitId === habit.id);
  const days = eachDay(start, end);
  const checkInDates = habitCheckIns.map((c) => c.date);

  const scheduled = expectedCount(habit.schedule, days, checkInDates);

  let logged = 0;
  for (const day of days) {
    if (!habitOccursOn(habit.schedule, day, doneEarlierThisWeek(day, checkInDates))) continue;
    const checkIn = habitCheckIns.find((c) => c.date.getTime() === day.getTime());
    if (checkIn) logged += checkIn.level === "FULL" ? 1 : 0.5;
  }
  return { scheduled, logged };
}

/** logged (full = 1, minimum/"partial" = 0.5) ÷ scheduled occurrences,
 * across every habit, over [start, end] inclusive. */
export function computeAdherence(habits: HabitFixture[], checkIns: CheckInFixture[], start: Date, end: Date): number {
  let scheduled = 0;
  let logged = 0;
  for (const habit of habits) {
    const r = adherenceForHabit(habit, checkIns, start, end);
    scheduled += r.scheduled;
    logged += r.logged;
  }
  return scheduled === 0 ? 0 : (logged / scheduled) * 100;
}

/** tasks closed ÷ tasks due, over tasks whose dueDate falls in [start, end]. */
export function computeFollowThrough(tasks: TaskFixture[], start: Date, end: Date): number {
  const due = tasks.filter((t) => inRange(t.dueDate, start, end));
  if (due.length === 0) return 0;
  const closed = due.filter((t) => t.completedAt !== null).length;
  return (closed / due.length) * 100;
}

/** (income − outgoings) ÷ income, clamped to 0–100, over [start, end] —
 * excludes receivable/goal-contribution-flagged transactions from both
 * sides, since neither is real income or spend. */
export function computeSurplusRate(transactions: TransactionFixture[], start: Date, end: Date): number {
  const inRangeTx = transactions.filter((t) => inRange(t.date, start, end) && isRealSpend(t));
  const income = inRangeTx.filter((t) => t.direction === "IN").reduce((sum, t) => sum + t.amount, 0);
  const outgoings = inRangeTx.filter((t) => t.direction === "OUT").reduce((sum, t) => sum + t.amount, 0);
  if (income <= 0) return 0;
  return Math.max(0, Math.min(100, ((income - outgoings) / income) * 100));
}

/**
 * `momentum = round(0.5 × adherence% + 0.3 × followThrough% + 0.2 × surplusRate%)`
 * over [windowStart, windowEnd] inclusive — see MOMENTUM_WEIGHTS. Pure: all
 * data is passed in already-fetched, so this runs the same in a unit test
 * fixture as it does against real rows.
 */
export function computeMomentumMetrics(inputs: MomentumInputs, windowStart: Date, windowEnd: Date): MomentumMetrics {
  const adherence = computeAdherence(inputs.habits, inputs.checkIns, windowStart, windowEnd);
  const followThrough = computeFollowThrough(inputs.tasks, windowStart, windowEnd);
  const surplusRate = computeSurplusRate(inputs.transactions, windowStart, windowEnd);
  const score = Math.round(
    MOMENTUM_WEIGHTS.adherence * adherence + MOMENTUM_WEIGHTS.followThrough * followThrough + MOMENTUM_WEIGHTS.surplusRate * surplusRate
  );
  return { score, adherence, followThrough, surplusRate };
}

/**
 * The 12-bar history strip: one Momentum score per day for the last 12
 * days, each using its own trailing 28-day window — so the strip shows how
 * the rolling score has been trending, not 12 disjoint slices of the
 * period. `asOf` is the most recent bar (today).
 */
export function computeMomentumHistory(inputs: MomentumInputs, asOf: Date): number[] {
  const today = utcMidnight(asOf);
  const bars: number[] = [];
  for (let i = HISTORY_BARS - 1; i >= 0; i--) {
    const end = new Date(today.getTime() - i * DAY_MS);
    const start = new Date(end.getTime() - (WINDOW_DAYS - 1) * DAY_MS);
    bars.push(computeMomentumMetrics(inputs, start, end).score);
  }
  return bars;
}

/** The rolling 28-day window ending on `asOf` (inclusive), and the equal-
 * length window immediately before it — the pair Momentum's hero card
 * compares for its delta and written read. */
export function momentumWindows(asOf: Date): { current: [Date, Date]; previous: [Date, Date] } {
  const today = utcMidnight(asOf);
  const currentEnd = today;
  const currentStart = new Date(today.getTime() - (WINDOW_DAYS - 1) * DAY_MS);
  const previousEnd = new Date(currentStart.getTime() - DAY_MS);
  const previousStart = new Date(previousEnd.getTime() - (WINDOW_DAYS - 1) * DAY_MS);
  return { current: [currentStart, currentEnd], previous: [previousStart, previousEnd] };
}

const METRIC_KEYS = ["adherence", "followThrough", "surplusRate"] as const;
type MetricKey = (typeof METRIC_KEYS)[number];

const METRIC_DOMAIN: Record<MetricKey, string> = {
  adherence: "Habits",
  followThrough: "Tasks",
  surplusRate: "Finances",
};

const METRIC_NOUN: Record<MetricKey, string> = {
  adherence: "adherence",
  followThrough: "follow-through",
  surplusRate: "surplus",
};

/**
 * A written read generated from the current/previous metrics, not
 * hand-written — per the design_handoff_aayan README's template
 * ("<Pillar> is carrying the period — <metric> up N points while <other>
 * held flat. The weak link is <weakest metric>: <consequence>."). The
 * three Momentum inputs aren't Pillar-scoped, so this substitutes the
 * domain each metric belongs to (Habits / Tasks / Finances) for "Pillar".
 */
export function momentumWrittenRead(current: MomentumMetrics, previous: MomentumMetrics): string {
  const deltas: Record<MetricKey, number> = {
    adherence: current.adherence - previous.adherence,
    followThrough: current.followThrough - previous.followThrough,
    surplusRate: current.surplusRate - previous.surplusRate,
  };

  const leader = METRIC_KEYS.reduce((a, b) => (deltas[b] > deltas[a] ? b : a));
  const weakest = METRIC_KEYS.reduce((a, b) => (current[b] < current[a] ? b : a));
  const other = METRIC_KEYS.find((k) => k !== leader && k !== weakest) ?? METRIC_KEYS.find((k) => k !== leader)!;

  const leaderDelta = Math.round(deltas[leader]);
  const trend = leaderDelta >= 0 ? "up" : "down";
  const otherDelta = Math.round(deltas[other]);
  const otherPhrase = Math.abs(otherDelta) <= 1 ? `${METRIC_NOUN[other]} held flat` : `${METRIC_NOUN[other]} moved with it`;

  return `${METRIC_DOMAIN[leader]} is carrying this period — ${METRIC_NOUN[leader]} ${trend} ${Math.abs(leaderDelta)} points while ${otherPhrase}. The weak link is ${METRIC_NOUN[weakest]}: ${Math.round(current[weakest])}% and dragging the score down.`;
}

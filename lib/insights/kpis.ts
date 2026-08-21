import {
  adherenceForHabit,
  computeAdherence,
  computeFollowThrough,
  computeSurplusRate,
  eachDay,
  inRange,
  type HabitFixture,
  type CheckInFixture,
  type TaskFixture,
  type TransactionFixture,
} from "./momentum";

const DAY_MS = 24 * 60 * 60 * 1000;
const SPARKLINE_BARS = 10;
const GOAL_VELOCITY_LABEL = "Goal velocity";

export type KpiKey = "adherence" | "followThrough" | "goalVelocity" | "surplusRate";

export type KpiResult = {
  value: number;
  delta: number;
  sparkline: number[];
  diagnosis: string;
};

/** Splits [start, end] into `barCount` contiguous, non-overlapping
 * segments — a trend sparkline showing real variation across the period,
 * not a smoothed rolling curve (contrast with Momentum's rolling-window
 * history strip in momentum.ts, which is a deliberately different shape:
 * that one always covers a fixed 28-day window regardless of the page's
 * range control, so its bars overlap by design; a KPI's sparkline instead
 * covers exactly the selected range, split into equal slices). The last
 * segment absorbs any remainder day from integer division. */
function splitIntoBars(start: Date, end: Date, barCount: number): [Date, Date][] {
  const totalDays = Math.round((end.getTime() - start.getTime()) / DAY_MS) + 1;
  const perBar = Math.max(1, Math.floor(totalDays / barCount));
  const bars: [Date, Date][] = [];
  let cursor = start.getTime();
  for (let i = 0; i < barCount; i++) {
    const isLast = i === barCount - 1;
    const barEnd = isLast ? end.getTime() : Math.min(end.getTime(), cursor + (perBar - 1) * DAY_MS);
    bars.push([new Date(cursor), new Date(barEnd)]);
    cursor = barEnd + DAY_MS;
    if (cursor > end.getTime()) break;
  }
  // Pad with the last real value if the range was shorter than barCount days.
  while (bars.length < barCount) bars.push(bars[bars.length - 1] ?? [start, end]);
  return bars;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// --- Habit adherence ---

export type HabitAdherenceFixture = HabitFixture & { name: string };

export function computeHabitAdherenceKpi(
  habits: HabitAdherenceFixture[],
  checkIns: CheckInFixture[],
  currentStart: Date,
  currentEnd: Date,
  previousStart: Date,
  previousEnd: Date
): KpiResult {
  const value = computeAdherence(habits, checkIns, currentStart, currentEnd);
  const previous = computeAdherence(habits, checkIns, previousStart, previousEnd);
  const sparkline = splitIntoBars(currentStart, currentEnd, SPARKLINE_BARS).map(([s, e]) => computeAdherence(habits, checkIns, s, e));

  const perHabit = habits
    .map((h) => {
      const { scheduled, logged } = adherenceForHabit(h, checkIns, currentStart, currentEnd);
      return { id: h.id, name: h.name, pct: scheduled === 0 ? null : (logged / scheduled) * 100 };
    })
    .filter((h): h is { id: string; name: string; pct: number } => h.pct !== null);

  const weakest = perHabit.length > 0 ? perHabit.reduce((a, b) => (b.pct < a.pct ? b : a)) : null;

  const trendPhrase = value - previous >= 10 ? "Best run in a while." : value - previous <= -10 ? "Slipping this period." : "Holding steady.";
  const diagnosis = weakest && weakest.pct < 80 ? `${trendPhrase} ${weakest.name} is the only miss.` : trendPhrase;

  return { value: round1(value), delta: round1(value - previous), sparkline: sparkline.map(round1), diagnosis };
}

// --- Task follow-through ---

export type TaskWithListFixture = TaskFixture & { listName: string | null };

export function computeTaskFollowThroughKpi(
  tasks: TaskWithListFixture[],
  currentStart: Date,
  currentEnd: Date,
  previousStart: Date,
  previousEnd: Date
): KpiResult {
  const value = computeFollowThrough(tasks, currentStart, currentEnd);
  const previous = computeFollowThrough(tasks, previousStart, previousEnd);
  const sparkline = splitIntoBars(currentStart, currentEnd, SPARKLINE_BARS).map(([s, e]) => computeFollowThrough(tasks, s, e));

  const dueInRange = tasks.filter((t) => inRange(t.dueDate, currentStart, currentEnd));
  const openByList = new Map<string, number>();
  for (const t of dueInRange) {
    if (t.completedAt !== null) continue;
    const key = t.listName ?? "Inbox";
    openByList.set(key, (openByList.get(key) ?? 0) + 1);
  }
  const worstList = [...openByList.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;

  const trendPhrase = value - previous >= 10 ? "Closing more than usual." : value - previous <= -10 ? "Falling behind." : "About the same as last period.";
  const diagnosis = worstList
    ? `${trendPhrase} ${worstList[0]} is carrying the most open tasks (${worstList[1]}).`
    : trendPhrase;

  return { value: round1(value), delta: round1(value - previous), sparkline: sparkline.map(round1), diagnosis };
}

// --- Goal velocity ---

export type GoalActivityFixture = { id: string; name: string; lastActivityAt: Date | null };

/** goals with linked habit/task activity in the window ÷ active goals.
 * The handoff's module text names a fixed "last 14 days"; this instead
 * uses the page's own selected window so the KPI actually responds to the
 * range control like the Insights header says every module must — see
 * lib/insights/kpis.ts's caller for how the window is chosen. */
export function computeGoalVelocityKpi(
  goals: GoalActivityFixture[],
  currentStart: Date,
  currentEnd: Date,
  previousStart: Date,
  previousEnd: Date
): KpiResult {
  function velocity(start: Date, end: Date): number {
    // `goals` is already scoped to active goals by the caller.
    if (goals.length === 0) return 0;
    const withActivity = goals.filter((g) => g.lastActivityAt && inRange(g.lastActivityAt, start, end));
    return (withActivity.length / goals.length) * 100;
  }

  const value = velocity(currentStart, currentEnd);
  const previous = velocity(previousStart, previousEnd);
  const sparkline = splitIntoBars(currentStart, currentEnd, SPARKLINE_BARS).map(([s, e]) => velocity(s, e));

  const stalled = goals.find((g) => !g.lastActivityAt || !inRange(g.lastActivityAt, currentStart, currentEnd));
  const trendPhrase = value - previous >= 10 ? "More goals moving than last period." : value - previous <= -10 ? "Fewer goals moving." : "Steady.";
  const diagnosis = stalled ? `${trendPhrase} "${stalled.name}" hasn't moved.` : goals.length === 0 ? "No active goals yet." : trendPhrase;

  return { value: round1(value), delta: round1(value - previous), sparkline: sparkline.map(round1), diagnosis };
}

// --- Surplus rate ---

export type CategorizedTransactionFixture = TransactionFixture & { category: string };

export function computeSurplusRateKpi(
  transactions: CategorizedTransactionFixture[],
  currentStart: Date,
  currentEnd: Date,
  previousStart: Date,
  previousEnd: Date
): KpiResult {
  const value = computeSurplusRate(transactions, currentStart, currentEnd);
  const previous = computeSurplusRate(transactions, previousStart, previousEnd);
  const sparkline = splitIntoBars(currentStart, currentEnd, SPARKLINE_BARS).map(([s, e]) => computeSurplusRate(transactions, s, e));

  const outByCategory = new Map<string, number>();
  for (const t of transactions) {
    if (t.direction !== "OUT" || !inRange(t.date, currentStart, currentEnd)) continue;
    outByCategory.set(t.category, (outByCategory.get(t.category) ?? 0) + t.amount);
  }
  const biggestDrain = [...outByCategory.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;

  const trendPhrase = value - previous >= 10 ? "Surplus improving." : value - previous <= -10 ? "Surplus shrinking." : "About flat.";
  const diagnosis = biggestDrain ? `${trendPhrase} ${biggestDrain[0]} is the biggest drain.` : trendPhrase;

  return { value: round1(value), delta: round1(value - previous), sparkline: sparkline.map(round1), diagnosis };
}

export const KPI_LABEL: Record<KpiKey, string> = {
  adherence: "Habit adherence",
  followThrough: "Task follow-through",
  goalVelocity: GOAL_VELOCITY_LABEL,
  surplusRate: "Surplus rate",
};

// --- Shared drill-down (opened from any KPI card, and later correlation
// cards per the design_handoff_aayan README's Drill-down spec) ---

const DRILLDOWN_BARS = 14;
const MAX_ENTRIES = 20;

export type DrillDownEntry = { date: string; label: string; value: string; tone: "positive" | "danger" | "muted" };

export type DrillDownData = {
  kindEyebrow: string;
  title: string;
  summaryStats: { label: string; value: string }[];
  series: number[];
  entries: DrillDownEntry[];
  writtenRead: string;
};

/** Builds the sheet every KPI card's "Break down →" opens: three summary
 * stats, a 14-bar series, and dated "Underlying entries" rows (capped at
 * MAX_ENTRIES most recent — a year range would otherwise dump 365 rows
 * into a sheet meant to be skimmed, not a full export). `rangeValue`
 * computes the KPI over an arbitrary sub-window, reused here both per-day
 * (for entries) and per-bar (for the series) so the drill-down always
 * agrees with the card's own top-line number. */
function buildDrillDown(opts: {
  kindEyebrow: string;
  title: string;
  value: number;
  previous: number;
  unit: string;
  start: Date;
  end: Date;
  rangeValue: (start: Date, end: Date) => number;
  entryLabel: (day: Date) => string;
  tone: (val: number) => "positive" | "danger" | "muted";
  writtenRead: string;
}): DrillDownData {
  const delta = opts.value - opts.previous;
  const entries = eachDay(opts.start, opts.end)
    .map((day): DrillDownEntry => {
      const val = opts.rangeValue(day, day);
      return { date: day.toISOString().slice(0, 10), label: opts.entryLabel(day), value: `${round1(val)}${opts.unit}`, tone: opts.tone(val) };
    })
    .reverse()
    .slice(0, MAX_ENTRIES);

  return {
    kindEyebrow: opts.kindEyebrow,
    title: opts.title,
    summaryStats: [
      { label: "This period", value: `${round1(opts.value)}${opts.unit}` },
      { label: "Previous period", value: `${round1(opts.previous)}${opts.unit}` },
      { label: "Change", value: `${delta >= 0 ? "+" : ""}${round1(delta)}${opts.unit}` },
    ],
    series: splitIntoBars(opts.start, opts.end, DRILLDOWN_BARS).map(([s, e]) => round1(opts.rangeValue(s, e))),
    entries,
    writtenRead: opts.writtenRead,
  };
}

function pctTone(val: number): "positive" | "danger" | "muted" {
  return val >= 80 ? "positive" : val < 50 ? "danger" : "muted";
}

export function buildHabitAdherenceDrillDown(
  habits: HabitAdherenceFixture[],
  checkIns: CheckInFixture[],
  currentStart: Date,
  currentEnd: Date,
  previousStart: Date,
  previousEnd: Date,
  writtenRead: string
): DrillDownData {
  return buildDrillDown({
    kindEyebrow: "KPI breakdown",
    title: KPI_LABEL.adherence,
    value: computeAdherence(habits, checkIns, currentStart, currentEnd),
    previous: computeAdherence(habits, checkIns, previousStart, previousEnd),
    unit: "%",
    start: currentStart,
    end: currentEnd,
    rangeValue: (s, e) => computeAdherence(habits, checkIns, s, e),
    entryLabel: (day) => day.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
    tone: pctTone,
    writtenRead,
  });
}

export function buildTaskFollowThroughDrillDown(
  tasks: TaskWithListFixture[],
  currentStart: Date,
  currentEnd: Date,
  previousStart: Date,
  previousEnd: Date,
  writtenRead: string
): DrillDownData {
  return buildDrillDown({
    kindEyebrow: "KPI breakdown",
    title: KPI_LABEL.followThrough,
    value: computeFollowThrough(tasks, currentStart, currentEnd),
    previous: computeFollowThrough(tasks, previousStart, previousEnd),
    unit: "%",
    start: currentStart,
    end: currentEnd,
    rangeValue: (s, e) => computeFollowThrough(tasks, s, e),
    entryLabel: (day) => day.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
    tone: pctTone,
    writtenRead,
  });
}

export function buildGoalVelocityDrillDown(
  goals: GoalActivityFixture[],
  currentStart: Date,
  currentEnd: Date,
  previousStart: Date,
  previousEnd: Date,
  writtenRead: string
): DrillDownData {
  function velocity(start: Date, end: Date): number {
    if (goals.length === 0) return 0;
    const withActivity = goals.filter((g) => g.lastActivityAt && inRange(g.lastActivityAt, start, end));
    return (withActivity.length / goals.length) * 100;
  }
  return buildDrillDown({
    kindEyebrow: "KPI breakdown",
    title: KPI_LABEL.goalVelocity,
    value: velocity(currentStart, currentEnd),
    previous: velocity(previousStart, previousEnd),
    unit: "%",
    start: currentStart,
    end: currentEnd,
    rangeValue: velocity,
    entryLabel: (day) => day.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
    tone: pctTone,
    writtenRead,
  });
}

export function buildSurplusRateDrillDown(
  transactions: CategorizedTransactionFixture[],
  currentStart: Date,
  currentEnd: Date,
  previousStart: Date,
  previousEnd: Date,
  writtenRead: string
): DrillDownData {
  return buildDrillDown({
    kindEyebrow: "KPI breakdown",
    title: KPI_LABEL.surplusRate,
    value: computeSurplusRate(transactions, currentStart, currentEnd),
    previous: computeSurplusRate(transactions, previousStart, previousEnd),
    unit: "%",
    start: currentStart,
    end: currentEnd,
    rangeValue: (s, e) => computeSurplusRate(transactions, s, e),
    entryLabel: (day) => day.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
    tone: pctTone,
    writtenRead,
  });
}

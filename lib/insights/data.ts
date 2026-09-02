import "server-only";
import { prisma } from "@/lib/prisma";
import {
  computeMomentumMetrics,
  computeMomentumHistory,
  momentumWindows,
  momentumWrittenRead,
  MOMENTUM_WEIGHTS,
  computeAdherence,
  computeFollowThrough,
  type MomentumInputs,
} from "./momentum";
import {
  computeHabitAdherenceKpi,
  computeTaskFollowThroughKpi,
  computeGoalVelocityKpi,
  computeSurplusRateKpi,
  computeSystemsOnTrackKpi,
  buildHabitAdherenceDrillDown,
  buildTaskFollowThroughDrillDown,
  buildGoalVelocityDrillDown,
  buildSurplusRateDrillDown,
  buildSystemsOnTrackDrillDown,
  onTrackPercent,
  type ExperimentReviewFixture,
  type KpiResult,
  type DrillDownData,
} from "./kpis";
import { insightsWindows, RANGE_DAYS, type InsightsRange } from "./range";
import { computeConsistencyGrid, CONSISTENCY_GRID_MAX_DAYS } from "./consistency";
import { computeNeglectRadar, type NeglectFixture } from "./neglect";
import { computeAttentionBalance, type ActivityFixture, type PillarFixture } from "./attention-balance";
import { computeTaskFlow, TASK_FLOW_WEEKS } from "./task-flow";
import { mondayOf } from "@/lib/habits/streak";
import {
  computeCorrelations,
  generateMetricCorrelationPairs,
  capCorrelationsByMagnitude,
  CORRELATION_MIN_N,
  type CorrelationPair,
  type MetricSeriesFixture,
} from "./correlations";
import { splitMean } from "./split-mean";
import { TRAINED_HABIT_ID } from "@/lib/daily-log/habit-seed";
import { computeTrajectory, type TrajectoryPoint } from "./trajectory";
import { netWorth } from "@/lib/finance/net-worth";
import { isRealSpend } from "@/lib/finance/logic";
import { FINANCE_NORTH_STAR_ID } from "@/lib/finance/north-star-id";
import { categorySpendTrend } from "./category-spend";
import { getTransactions } from "@/lib/finance/data";
import { METRIC_MOOD_ID } from "@/lib/metrics/seeded-ids";
import { computeWeeklyDigest, type DeltaFixture, type CorrelationFixture, type HabitAdherenceFixture } from "./weekly-digest";
import { adherenceForHabit } from "./momentum";
import { resolveColorHex, type ColorKey } from "@/lib/colors";

// Momentum's history strip needs 12 rolling 28-day windows, and its delta
// needs the 28-day window before that — furthest back is 12 + 28 + 28 days
// from today. Round up generously so a habit's schedule anchor just outside
// that still resolves correctly.
const LOOKBACK_DAYS = 12 + 28 + 28 + 3;
const DAY_MS = 24 * 60 * 60 * 1000;

export type MomentumSummary = {
  score: number;
  delta: number;
  history: number[];
  writtenRead: string;
  inputs: { adherence: number; followThrough: number; surplusRate: number };
  weights: typeof MOMENTUM_WEIGHTS;
};

async function getMomentumInputs(asOf: Date): Promise<MomentumInputs> {
  const lookbackStart = new Date(asOf.getTime() - LOOKBACK_DAYS * DAY_MS);

  const [habits, checkIns, tasks, transactions] = await Promise.all([
    prisma.habit.findMany({
      where: { status: "ACTIVE" },
      select: {
        id: true,
        scheduleType: true,
        scheduleWeekdays: true,
        scheduleIntervalN: true,
        scheduleAnchorDate: true,
        scheduleTargetCount: true,
      },
    }),
    prisma.checkIn.findMany({
      where: { date: { gte: lookbackStart, lte: asOf } },
      select: { habitId: true, date: true, level: true },
    }),
    prisma.task.findMany({
      where: { dueDate: { gte: lookbackStart, lte: asOf }, deletedAt: null },
      select: { dueDate: true, completedAt: true },
    }),
    prisma.transaction.findMany({
      where: { date: { gte: lookbackStart, lte: asOf } },
      select: { date: true, amount: true, direction: true, receivableId: true, goalContributionId: true, transferId: true },
    }),
  ]);

  return {
    habits: habits.map((h) => ({
      id: h.id,
      schedule: {
        scheduleType: h.scheduleType,
        scheduleWeekdays: h.scheduleWeekdays,
        scheduleIntervalN: h.scheduleIntervalN,
        scheduleAnchorDate: h.scheduleAnchorDate,
        scheduleTargetCount: h.scheduleTargetCount,
      },
    })),
    checkIns,
    tasks: tasks.filter((t): t is { dueDate: Date; completedAt: Date | null } => t.dueDate !== null),
    transactions: transactions.map((t) => ({
      date: t.date,
      amount: t.amount.toNumber(),
      direction: t.direction,
      receivableId: t.receivableId,
      goalContributionId: t.goalContributionId,
      transferId: t.transferId,
    })),
  };
}

/** Momentum is a fixed rolling-28-day metric, independent of the Insights
 * page's range control (see the design_handoff_aayan README's Insights
 * spec) — the control exists for later modules to read, not this one. */
export async function getMomentumSummary(asOf: Date = new Date()): Promise<MomentumSummary> {
  const inputs = await getMomentumInputs(asOf);
  const { current, previous } = momentumWindows(asOf);

  const currentMetrics = computeMomentumMetrics(inputs, current[0], current[1]);
  const previousMetrics = computeMomentumMetrics(inputs, previous[0], previous[1]);
  const history = computeMomentumHistory(inputs, asOf);

  return {
    score: currentMetrics.score,
    delta: currentMetrics.score - previousMetrics.score,
    history,
    writtenRead: momentumWrittenRead(currentMetrics, previousMetrics),
    inputs: {
      adherence: Math.round(currentMetrics.adherence),
      followThrough: Math.round(currentMetrics.followThrough),
      surplusRate: Math.round(currentMetrics.surplusRate),
    },
    weights: MOMENTUM_WEIGHTS,
  };
}

export type KpiWithDrillDown = KpiResult & { drillDown: DrillDownData };

export type KpiSummary = {
  adherence: KpiWithDrillDown;
  followThrough: KpiWithDrillDown;
  goalVelocity: KpiWithDrillDown;
  surplusRate: KpiWithDrillDown;
  systemsOnTrack: KpiWithDrillDown;
};

/** Every KPI computed over the page's actual selected range (and the
 * equal-length period before it) — unlike Momentum, these do respond to
 * the range control, per the Insights header's "in production it must
 * drive every module." */
export async function getKpiSummary(range: InsightsRange, asOf: Date = new Date()): Promise<KpiSummary> {
  const { current, previous } = insightsWindows(range, asOf);
  const lookbackStart = previous[0];

  const [habits, checkIns, tasks, transactions, goals, experiments] = await Promise.all([
    prisma.habit.findMany({
      where: { status: "ACTIVE" },
      select: {
        id: true,
        name: true,
        scheduleType: true,
        scheduleWeekdays: true,
        scheduleIntervalN: true,
        scheduleAnchorDate: true,
        scheduleTargetCount: true,
      },
    }),
    prisma.checkIn.findMany({
      where: { date: { gte: lookbackStart, lte: current[1] } },
      select: { habitId: true, date: true, level: true },
    }),
    prisma.task.findMany({
      where: { dueDate: { gte: lookbackStart, lte: current[1] }, deletedAt: null },
      select: { dueDate: true, completedAt: true, list: { select: { name: true } } },
    }),
    prisma.transaction.findMany({
      where: { date: { gte: lookbackStart, lte: current[1] } },
      select: {
        date: true,
        amount: true,
        direction: true,
        category: { select: { name: true } },
        receivableId: true,
        goalContributionId: true,
        transferId: true,
      },
    }),
    prisma.lifeGoal.findMany({
      where: { status: "ACTIVE" },
      select: {
        id: true,
        name: true,
        tasks: { select: { completedAt: true }, where: { completedAt: { not: null } } },
        habits: { select: { habit: { select: { checkIns: { select: { date: true } } } } } },
      },
    }),
    prisma.system.findMany({
      where: { state: "ACTIVE", type: "EXPERIMENT" },
      select: { id: true, name: true, review: true, verdict: true },
    }),
  ]);

  const habitFixtures = habits.map((h) => ({
    id: h.id,
    name: h.name,
    schedule: {
      scheduleType: h.scheduleType,
      scheduleWeekdays: h.scheduleWeekdays,
      scheduleIntervalN: h.scheduleIntervalN,
      scheduleAnchorDate: h.scheduleAnchorDate,
      scheduleTargetCount: h.scheduleTargetCount,
    },
  }));

  const taskFixtures = tasks
    .filter((t): t is typeof t & { dueDate: Date } => t.dueDate !== null)
    .map((t) => ({ dueDate: t.dueDate, completedAt: t.completedAt, listName: t.list?.name ?? null }));

  const transactionFixtures = transactions.map((t) => ({
    date: t.date,
    amount: t.amount.toNumber(),
    direction: t.direction,
    category: t.category.name,
    receivableId: t.receivableId,
    goalContributionId: t.goalContributionId,
    transferId: t.transferId,
  }));

  const goalFixtures = goals.map((g) => {
    const taskDates = g.tasks.map((t) => t.completedAt!.getTime());
    const habitDates = g.habits.flatMap((hg) => hg.habit.checkIns.map((c) => c.date.getTime()));
    const allDates = [...taskDates, ...habitDates];
    return { id: g.id, name: g.name, lastActivityAt: allDates.length > 0 ? new Date(Math.max(...allDates)) : null };
  });

  const adherence = computeHabitAdherenceKpi(habitFixtures, checkIns, current[0], current[1], previous[0], previous[1]);
  const followThrough = computeTaskFollowThroughKpi(taskFixtures, current[0], current[1], previous[0], previous[1]);
  const goalVelocity = computeGoalVelocityKpi(goalFixtures, current[0], current[1], previous[0], previous[1]);
  const surplusRate = computeSurplusRateKpi(transactionFixtures, current[0], current[1], previous[0], previous[1]);
  const systemsOnTrack = computeSystemsOnTrackKpi(experiments, current[0], current[1], previous[0], previous[1]);

  return {
    adherence: {
      ...adherence,
      drillDown: buildHabitAdherenceDrillDown(habitFixtures, checkIns, current[0], current[1], previous[0], previous[1], adherence.diagnosis),
    },
    followThrough: {
      ...followThrough,
      drillDown: buildTaskFollowThroughDrillDown(taskFixtures, current[0], current[1], previous[0], previous[1], followThrough.diagnosis),
    },
    goalVelocity: {
      ...goalVelocity,
      drillDown: buildGoalVelocityDrillDown(goalFixtures, current[0], current[1], previous[0], previous[1], goalVelocity.diagnosis),
    },
    surplusRate: {
      ...surplusRate,
      drillDown: buildSurplusRateDrillDown(transactionFixtures, current[0], current[1], previous[0], previous[1], surplusRate.diagnosis),
    },
    systemsOnTrack: {
      ...systemsOnTrack,
      drillDown: buildSystemsOnTrackDrillDown(experiments, current[0], current[1], previous[0], previous[1], systemsOnTrack.diagnosis),
    },
  };
}

/** The grid is 28 columns wide per the design_handoff_aayan README's
 * Consistency grid spec — but for a range shorter than 28 days (7d), it
 * genuinely responds to the range control by showing fewer columns rather
 * than 28 days' worth of data under a 7-day selection; for 30d/90d/Year
 * it caps at 28, since more than that stops being a grid anyone reads at
 * a glance. */
export async function getConsistencyGridSummary(range: InsightsRange, asOf: Date = new Date()) {
  const gridDays = Math.min(CONSISTENCY_GRID_MAX_DAYS, RANGE_DAYS[range]);
  const end = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate()));
  const start = new Date(end.getTime() - (gridDays - 1) * DAY_MS);
  // A week or so of slack before `start` so a WEEKLY/EVERY_N_WEEKS habit's
  // "already done this week" check (see habitOccursOn) is correct for the
  // first few grid days even when their week began before the window.
  const checkInFetchStart = new Date(start.getTime() - 7 * DAY_MS);

  const habits = await prisma.habit.findMany({
    where: { status: "ACTIVE" },
    select: {
      id: true,
      name: true,
      scheduleType: true,
      scheduleWeekdays: true,
      scheduleIntervalN: true,
      scheduleAnchorDate: true,
      pillar: { select: { color: true } },
      checkIns: { where: { date: { gte: checkInFetchStart, lte: end } }, select: { date: true, level: true } },
    },
  });

  const habitFixtures = habits.map((h) => ({
    id: h.id,
    name: h.name,
    schedule: { scheduleType: h.scheduleType, scheduleWeekdays: h.scheduleWeekdays, scheduleIntervalN: h.scheduleIntervalN, scheduleAnchorDate: h.scheduleAnchorDate },
    checkIns: h.checkIns,
  }));

  const colorByHabitId = new Map(habits.map((h) => [h.id, resolveColorHex(h.pillar?.color as ColorKey | null)]));
  const grid = computeConsistencyGrid(habitFixtures, start, end);
  return { ...grid, rows: grid.rows.map((r) => ({ ...r, color: colorByHabitId.get(r.habitId) ?? null })) };
}

export type ConsistencyGridSummary = Awaited<ReturnType<typeof getConsistencyGridSummary>>;

function latestOf(dates: (Date | null | undefined)[]): Date | null {
  const times = dates.filter((d): d is Date => d != null).map((d) => d.getTime());
  return times.length === 0 ? null : new Date(Math.max(...times));
}

/** Covers Areas, Goals, Lists, and Thoughts (as one aggregate row) — the
 * design_handoff_aayan README's Neglect radar spec. "Last activity" per
 * kind: an Area's own tasks/thoughts/habit check-ins; a Goal's linked
 * task completions/habit check-ins (same definition as Goal velocity in
 * lib/insights/kpis.ts); a List's own tasks; Thoughts' single row uses
 * the most recent Thought across the whole app, not scoped to any Area. */
export async function getNeglectRadar(asOf: Date = new Date()) {
  const [areas, goals, lists, latestThought] = await Promise.all([
    prisma.area.findMany({
      select: {
        id: true,
        pillarId: true,
        name: true,
        tasks: { select: { createdAt: true, completedAt: true } },
        thoughts: { select: { createdAt: true } },
        habits: { select: { checkIns: { select: { date: true } } } },
      },
    }),
    prisma.lifeGoal.findMany({
      where: { status: "ACTIVE" },
      select: {
        id: true,
        name: true,
        tasks: { select: { completedAt: true }, where: { completedAt: { not: null } } },
        habits: { select: { habit: { select: { checkIns: { select: { date: true } } } } } },
      },
    }),
    prisma.taskList.findMany({
      where: { archivedAt: null },
      select: { id: true, name: true, tasks: { select: { createdAt: true, completedAt: true } } },
    }),
    prisma.thought.findFirst({ orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
  ]);

  const fixtures: NeglectFixture[] = [
    ...areas.map((a): NeglectFixture => ({
      kind: "area",
      id: a.id,
      pillarId: a.pillarId,
      label: a.name,
      lastActivityAt: latestOf([
        ...a.tasks.flatMap((t) => [t.createdAt, t.completedAt]),
        ...a.thoughts.map((t) => t.createdAt),
        ...a.habits.flatMap((h) => h.checkIns.map((c) => c.date)),
      ]),
    })),
    ...goals.map((g): NeglectFixture => ({
      kind: "goal",
      id: g.id,
      label: g.name,
      lastActivityAt: latestOf([...g.tasks.map((t) => t.completedAt), ...g.habits.flatMap((hg) => hg.habit.checkIns.map((c) => c.date))]),
    })),
    ...lists.map((l): NeglectFixture => ({
      kind: "list",
      id: l.id,
      label: l.name,
      lastActivityAt: latestOf(l.tasks.flatMap((t) => [t.createdAt, t.completedAt])),
    })),
    { kind: "thoughts", id: "thoughts", label: "Thoughts", lastActivityAt: latestThought?.createdAt ?? null },
  ];

  return computeNeglectRadar(fixtures, asOf);
}

/** Actual share of activity per Pillar over the selected range, weighed
 * against each Pillar's stated intended share (#58's Pillar.intendedTimeShare).
 * Responds to the range control — "actual share of activity" is inherently
 * a windowed measure, unlike Momentum/Neglect radar's fixed/as-of-now
 * shapes. */
export async function getAttentionBalance(range: InsightsRange, asOf: Date = new Date()) {
  const { current } = insightsWindows(range, asOf);
  const [start, end] = current;

  const [pillars, completedTasks, checkIns, thoughts] = await Promise.all([
    prisma.pillar.findMany({ select: { id: true, name: true, intendedTimeShare: true } }),
    prisma.task.findMany({
      where: { completedAt: { gte: start, lte: end } },
      select: { pillarId: true },
    }),
    prisma.checkIn.findMany({
      where: { date: { gte: start, lte: end } },
      select: { habit: { select: { pillarId: true } } },
    }),
    prisma.thought.findMany({ where: { createdAt: { gte: start, lte: end } }, select: { id: true } }),
  ]);

  const pillarFixtures: PillarFixture[] = pillars.map((p) => ({ id: p.id, name: p.name, intendedSharePct: p.intendedTimeShare }));
  const activities: ActivityFixture[] = [
    ...completedTasks.map((t): ActivityFixture => ({ pillarId: t.pillarId, isThought: false })),
    ...checkIns.map((c): ActivityFixture => ({ pillarId: c.habit.pillarId, isThought: false })),
    ...thoughts.map((): ActivityFixture => ({ pillarId: null, isThought: true })),
  ];

  return computeAttentionBalance(pillarFixtures, activities);
}

const DAY_MS_TASK_FLOW = 24 * 60 * 60 * 1000;

/** Fixed at 8 weeks regardless of the range control, same as Momentum and
 * the Neglect radar — the module's own spec is "per week over 8 weeks,"
 * not a variable-width chart. */
export async function getTaskFlowSummary(asOf: Date = new Date()) {
  const currentWeekStart = mondayOf(asOf);
  const weekStarts = Array.from(
    { length: TASK_FLOW_WEEKS },
    (_, i) => new Date(currentWeekStart.getTime() - (TASK_FLOW_WEEKS - 1 - i) * 7 * DAY_MS_TASK_FLOW)
  );
  const windowStart = weekStarts[0];
  const windowEnd = new Date(currentWeekStart.getTime() + 7 * DAY_MS_TASK_FLOW);

  const [windowTasks, openTasks] = await Promise.all([
    prisma.task.findMany({
      where: {
        deletedAt: null,
        OR: [
          { createdAt: { gte: windowStart, lt: windowEnd } },
          { completedAt: { gte: windowStart, lt: windowEnd } },
          { dueDate: { gte: windowStart, lt: windowEnd } },
        ],
      },
      select: { createdAt: true, dueDate: true, completedAt: true },
    }),
    prisma.task.findMany({
      where: { status: "ACTIVE", deletedAt: null, archivedAt: null },
      select: { createdAt: true },
    }),
  ]);

  return computeTaskFlow(windowTasks, openTasks, weekStarts, asOf);
}

const DAY_MS_CORR = 24 * 60 * 60 * 1000;

function dateKeyCorr(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function eachDayCorr(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  for (let t = start.getTime(); t <= end.getTime(); t += DAY_MS_CORR) days.push(new Date(t));
  return days;
}

/** Correlations between paired daily series — responds to the range
 * control (a longer range gives Pearson's r more points to work with,
 * which is exactly what the n < CORRELATION_MIN_N suppression is
 * calibrated for). Pairs
 * only include days where *both* series have a real observation — a
 * missing pain log or a day with no transactions is excluded from both
 * sides, not defaulted to 0, since that would fabricate a data point that
 * was never actually logged. */
export async function getCorrelations(range: InsightsRange, asOf: Date = new Date()) {
  const { current } = insightsWindows(range, asOf);
  const [start, end] = current;
  const days = eachDayCorr(start, end);

  const [habits, checkIns, tasks, painLogs, transactions, metrics, metricEntries, experiments] = await Promise.all([
    prisma.habit.findMany({
      where: { status: "ACTIVE" },
      select: {
        id: true,
        scheduleType: true,
        scheduleWeekdays: true,
        scheduleIntervalN: true,
        scheduleAnchorDate: true,
        scheduleTargetCount: true,
      },
    }),
    prisma.checkIn.findMany({ where: { date: { gte: start, lte: end } }, select: { habitId: true, date: true, level: true } }),
    prisma.task.findMany({ where: { dueDate: { gte: start, lte: end }, deletedAt: null }, select: { dueDate: true, completedAt: true } }),
    prisma.painMobilityLog.findMany({ where: { date: { gte: start, lte: end } }, select: { date: true, pain: true } }),
    prisma.transaction.findMany({
      where: { date: { gte: start, lte: end } },
      select: { date: true, amount: true, direction: true, receivableId: true, goalContributionId: true, transferId: true },
    }),
    // Every numeric-valued (NUMBER/SCALE_5/BOOLEAN) Metric — ENUM/TEXT
    // metrics have no numberValue to correlate. #187 generalizes pairing
    // over all of these rather than a hand-picked list; sleep-stiffness
    // and mood are just ordinary Metrics among them now, not special-cased
    // at the query level.
    prisma.metric.findMany({
      where: { archivedAt: null, valueType: { in: ["NUMBER", "SCALE_5", "BOOLEAN"] } },
      select: { id: true, name: true },
    }),
    prisma.metricEntry.findMany({
      where: { date: { gte: start, lte: end }, metric: { archivedAt: null, valueType: { in: ["NUMBER", "SCALE_5", "BOOLEAN"] } } },
      select: { metricId: true, date: true, numberValue: true },
    }),
    prisma.system.findMany({
      where: { state: "ACTIVE", type: "EXPERIMENT" },
      select: { id: true, name: true, review: true, verdict: true },
    }),
  ]);

  const habitFixtures = habits.map((h) => ({
    id: h.id,
    schedule: {
      scheduleType: h.scheduleType,
      scheduleWeekdays: h.scheduleWeekdays,
      scheduleIntervalN: h.scheduleIntervalN,
      scheduleAnchorDate: h.scheduleAnchorDate,
      scheduleTargetCount: h.scheduleTargetCount,
    },
  }));
  const taskFixtures = tasks
    .filter((t): t is { dueDate: Date; completedAt: Date | null } => t.dueDate !== null)
    .map((t) => ({ dueDate: t.dueDate, completedAt: t.completedAt }));

  const adherenceByDay = new Map(days.map((d) => [dateKeyCorr(d), computeAdherence(habitFixtures, checkIns, d, d)]));
  const followThroughByDay = new Map(days.map((d) => [dateKeyCorr(d), computeFollowThrough(taskFixtures, d, d)]));

  const painByDay = new Map<string, number[]>();
  for (const log of painLogs) {
    const key = dateKeyCorr(log.date);
    painByDay.set(key, [...(painByDay.get(key) ?? []), log.pain]);
  }
  const avgPainByDay = new Map([...painByDay.entries()].map(([k, vs]) => [k, vs.reduce((s, v) => s + v, 0) / vs.length]));

  // Same exclusion rule as computeSurplusRate (lib/insights/momentum.ts):
  // a receivable/goal-contribution-flagged transaction is a
  // reclassification, not real income/spend (ADR-0010/#114/#120). Not a
  // literal call to computeSurplusRate itself — that returns a clamped
  // 0-100 rate over a range, a different shape from this pair's raw
  // signed daily net amount ("Daily surplus") — but the same underlying
  // filter (isRealSpend, lib/finance/logic.ts), kept in lockstep rather
  // than re-derived.
  const realTransactions = transactions.filter(isRealSpend);

  const surplusByDay = new Map<string, number>();
  const hasTxByDay = new Set<string>();
  for (const tx of realTransactions) {
    const key = dateKeyCorr(tx.date);
    hasTxByDay.add(key);
    const signed = tx.direction === "IN" ? tx.amount.toNumber() : -tx.amount.toNumber();
    surplusByDay.set(key, (surplusByDay.get(key) ?? 0) + signed);
  }

  function pairedSeries(a: Map<string, number>, bDays: Set<string>, b: Map<string, number>): { seriesA: number[]; seriesB: number[]; dates: string[] } {
    const seriesA: number[] = [];
    const seriesB: number[] = [];
    const dates: string[] = [];
    for (const key of a.keys()) {
      if (!bDays.has(key)) continue;
      seriesA.push(a.get(key)!);
      seriesB.push(b.get(key)!);
      dates.push(key);
    }
    return { seriesA, seriesB, dates };
  }

  const adherenceVsFollowThrough = pairedSeries(adherenceByDay, new Set(followThroughByDay.keys()), followThroughByDay);
  const adherenceVsPain = pairedSeries(adherenceByDay, new Set(avgPainByDay.keys()), avgPainByDay);
  const adherenceVsSurplus = pairedSeries(adherenceByDay, hasTxByDay, surplusByDay);

  // "On track" is a live snapshot check, re-evaluated per day via the same
  // onTrackPercent aggregate computeSystemsOnTrackKpi's own sparkline uses
  // (lib/insights/kpis.ts) — not a historical record of what verdict/review
  // looked like on that day (#134, ADR-0012). Zero active Experiments
  // produces a flat 0% series (zero variance), which pearsonCorrelation and
  // computeCorrelations already drop rather than showing a fabricated
  // "0% on track" correlation.
  const experimentFixtures: ExperimentReviewFixture[] = experiments;
  const systemsOnTrackByDay = new Map(days.map((day) => [dateKeyCorr(day), onTrackPercent(experimentFixtures, day)]));
  const systemsOnTrackVsSurplus = pairedSeries(systemsOnTrackByDay, hasTxByDay, surplusByDay);

  // These four don't cleanly reduce to a pair of numeric Metrics (Habit
  // adherence/Task follow-through/Systems-on-track are computed rollups,
  // and pain is sourced from PainMobilityLog, which #181 explicitly keeps
  // out of scope) — kept as their own hand-built CorrelationPairs.
  const specialPairs: CorrelationPair[] = [
    { id: "adherence-followthrough", labelA: "Habit adherence", labelB: "Task follow-through", ...adherenceVsFollowThrough },
    { id: "adherence-pain", labelA: "Habit adherence", labelB: "Pain level", ...adherenceVsPain },
    { id: "adherence-surplus", labelA: "Habit adherence", labelB: "Daily surplus", ...adherenceVsSurplus },
    { id: "systemsontrack-surplus", labelA: "Systems on track", labelB: "Daily surplus", ...systemsOnTrackVsSurplus },
  ];

  // Every pair of numeric Metrics (#187) — sleep-stiffness and any other
  // Metric-to-Metric relationship (e.g. the old sleep-stiffness pair, now
  // just two ordinary seeded Metrics among the rest) falls out of this
  // generic mechanism rather than being hand-picked. Capped to the top
  // CORRELATION_PAIR_CAP by |r| so the page doesn't grow an unbounded wall
  // of low-signal pairs as the number of logged Metrics grows — the
  // special pairs above are always shown regardless, same as before #187.
  const metricEntriesByMetric = new Map<string, { date: string; value: number }[]>();
  for (const e of metricEntries) {
    if (e.numberValue === null) continue;
    const list = metricEntriesByMetric.get(e.metricId) ?? [];
    list.push({ date: dateKeyCorr(e.date), value: e.numberValue });
    metricEntriesByMetric.set(e.metricId, list);
  }
  const metricFixtures: MetricSeriesFixture[] = metrics.map((m) => ({ id: m.id, name: m.name, entries: metricEntriesByMetric.get(m.id) ?? [] }));
  const genericMetricPairs = generateMetricCorrelationPairs(metricFixtures);
  const genericResults = capCorrelationsByMagnitude(computeCorrelations(genericMetricPairs));

  // Trained-vs-mood isn't a Pearson pair — "trained" is a boolean per day
  // (from the TRAINED_HABIT_ID check-in, same derivation as
  // lib/daily-log/data.ts's getDerivedStateFields), not a numeric series —
  // so it's a mean-split (lib/insights/split-mean.ts), a different shape
  // from CorrelationResult, surfaced as its own small card (#128, ADR-0011).
  const moodLogs = metricEntries
    .filter((e) => e.metricId === METRIC_MOOD_ID && e.numberValue !== null)
    .map((e) => ({ date: e.date, value: e.numberValue! }));
  const trainedDates = checkIns.filter((c) => c.habitId === TRAINED_HABIT_ID).map((c) => c.date);
  const trainedVsMood = moodLogs.length >= CORRELATION_MIN_N ? splitMean(moodLogs, trainedDates) : null;

  return { pairs: [...computeCorrelations(specialPairs), ...genericResults], trainedVsMood };
}

const TRAJECTORY_LOOKBACK_DAYS = 60;
const DAY_MS_TRAJECTORY = 24 * 60 * 60 * 1000;

/** Finance is the only Pillar with an actual numeric target/deadline
 * today (Pillar.northStar elsewhere is free text, not a structured
 * target — see #58's schema comment) — this covers what the handoff's
 * "per Pillar with a North Star target/deadline" actually has data for,
 * rather than inventing target/deadline fields other Pillars don't have.
 * There's also no logged net-worth history to read directly, so the
 * actuals series is *approximated* backward from today's real net worth
 * by undoing each day's net transactions — an honest reconstruction
 * given the data that exists, not a literal historical log. Fixed at a
 * 60-day lookback regardless of the range control, same reasoning as
 * Momentum/Task flow's fixed windows. */
export async function getTrajectory(asOf: Date = new Date()) {
  const [accounts, northStar, transactions] = await Promise.all([
    prisma.account.findMany({
      select: { type: true, excluded: true, snapshots: { orderBy: { date: "desc" }, take: 1, select: { balance: true } } },
    }),
    prisma.financeNorthStar.findUnique({ where: { id: FINANCE_NORTH_STAR_ID }, select: { target: true, deadline: true } }),
    prisma.transaction.findMany({
      where: { date: { gte: new Date(asOf.getTime() - TRAJECTORY_LOOKBACK_DAYS * DAY_MS_TRAJECTORY), lte: asOf } },
      select: { date: true, amount: true, direction: true },
    }),
  ]);

  if (!northStar || northStar.target === null) return null;

  const { accessible: currentValue } = netWorth(
    accounts.map((a) => ({ value: a.snapshots[0]?.balance.toNumber() ?? 0, type: a.type, excluded: a.excluded }))
  );

  const dailyNet = new Map<string, number>();
  for (const tx of transactions) {
    const key = tx.date.toISOString().slice(0, 10);
    const signed = tx.direction === "IN" ? tx.amount.toNumber() : -tx.amount.toNumber();
    dailyNet.set(key, (dailyNet.get(key) ?? 0) + signed);
  }

  const days = Array.from({ length: TRAJECTORY_LOOKBACK_DAYS + 1 }, (_, i) => {
    const t = asOf.getTime() - (TRAJECTORY_LOOKBACK_DAYS - i) * DAY_MS_TRAJECTORY;
    return new Date(t).toISOString().slice(0, 10);
  });
  const totalNetInWindow = days.reduce((sum, key) => sum + (dailyNet.get(key) ?? 0), 0);

  let running = currentValue - totalNetInWindow;
  const actuals: TrajectoryPoint[] = days.map((date) => {
    running += dailyNet.get(date) ?? 0;
    return { date, value: running };
  });

  const trajectory = computeTrajectory(actuals, northStar.target.toNumber(), northStar.deadline, asOf);
  return { ...trajectory, actuals, target: northStar.target.toNumber(), deadline: northStar.deadline?.toISOString().slice(0, 10) ?? null };
}

/** The prior this app holds about each correlation pair's expected
 * direction — see computeSurprising's doc comment in weekly-digest.ts.
 * Kept alongside the pair ids getCorrelations() already uses. */
const CORRELATION_EXPECTED_SIGN: Record<string, 1 | -1 | 0> = {
  "adherence-followthrough": 1,
  "adherence-pain": -1,
  "adherence-surplus": 1,
};

const CATEGORY_SPEND_TREND_MONTHS = 6;

/** Per-category spend trend + anomaly callouts over a fixed trailing
 * 6-month window (#180) — fixed, not the range control, same reasoning
 * as Momentum/Task flow/Trajectory's own fixed windows (a month-bucketed
 * spend trend doesn't map onto a day-count range control the way
 * KPIs/Correlations do). 6 months covers categorySpendDeviation's own
 * 3-prior-month baseline requirement for the trend's last (current)
 * month with room to spare, so one transaction fetch serves both the
 * trend and its anomaly callouts. */
export async function getCategorySpendSummary(asOf: Date = new Date()) {
  const currentMonthStart = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), 1));
  const months = Array.from(
    { length: CATEGORY_SPEND_TREND_MONTHS },
    (_, i) => new Date(Date.UTC(currentMonthStart.getUTCFullYear(), currentMonthStart.getUTCMonth() - (CATEGORY_SPEND_TREND_MONTHS - 1 - i), 1))
  );

  const transactions = await getTransactions({ date: { gte: months[0], lte: asOf } });

  return {
    months: months.map((m) => m.toISOString().slice(0, 7)),
    rows: categorySpendTrend(transactions, months),
  };
}

export type CategorySpendSummary = Awaited<ReturnType<typeof getCategorySpendSummary>>;

/** Assembles the Weekly digest from data this module already knows how
 * to compute: the four KPIs' week-over-week deltas (reusing getKpiSummary
 * over a 7d range so "this week" matches what the KPI cards themselves
 * would show at that range), the same Correlations pairs with each one's
 * expected-sign prior attached, and per-habit adherence over the current
 * Mon-Sun week for the "anchor worst to best" recommendation. */
export async function getWeeklyDigest(asOf: Date = new Date()) {
  const weekStart = mondayOf(asOf);

  const [kpis, correlations, habits, checkIns] = await Promise.all([
    getKpiSummary("7d", asOf),
    getCorrelations("90d", asOf),
    prisma.habit.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true, scheduleType: true, scheduleWeekdays: true, scheduleIntervalN: true, scheduleAnchorDate: true },
    }),
    prisma.checkIn.findMany({ where: { date: { gte: weekStart, lte: asOf } }, select: { habitId: true, date: true, level: true } }),
  ]);

  const deltas: DeltaFixture[] = [
    { label: "Habit adherence", delta: kpis.adherence.delta },
    { label: "Task follow-through", delta: kpis.followThrough.delta },
    { label: "Goal velocity", delta: kpis.goalVelocity.delta },
    { label: "Surplus rate", delta: kpis.surplusRate.delta },
  ];

  const correlationFixtures: CorrelationFixture[] = correlations.pairs.map((c) => ({
    labelA: c.labelA,
    labelB: c.labelB,
    r: c.r,
    expectedSign: CORRELATION_EXPECTED_SIGN[c.id] ?? 0,
  }));

  const habitAdherence: HabitAdherenceFixture[] = habits
    .map((h) => {
      const schedule = { scheduleType: h.scheduleType, scheduleWeekdays: h.scheduleWeekdays, scheduleIntervalN: h.scheduleIntervalN, scheduleAnchorDate: h.scheduleAnchorDate };
      const { scheduled, logged } = adherenceForHabit({ id: h.id, schedule }, checkIns, weekStart, asOf);
      return scheduled === 0 ? null : { name: h.name, pct: Math.round((logged / scheduled) * 100) };
    })
    .filter((h): h is HabitAdherenceFixture => h !== null);

  return computeWeeklyDigest(deltas, correlationFixtures, habitAdherence);
}

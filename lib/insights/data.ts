import "server-only";
import { prisma } from "@/lib/prisma";
import {
  computeMomentumMetrics,
  computeMomentumHistory,
  momentumWindows,
  momentumWrittenRead,
  MOMENTUM_WEIGHTS,
  type MomentumInputs,
} from "./momentum";
import {
  computeHabitAdherenceKpi,
  computeTaskFollowThroughKpi,
  computeGoalVelocityKpi,
  computeSurplusRateKpi,
  buildHabitAdherenceDrillDown,
  buildTaskFollowThroughDrillDown,
  buildGoalVelocityDrillDown,
  buildSurplusRateDrillDown,
  type KpiResult,
  type DrillDownData,
} from "./kpis";
import { insightsWindows, RANGE_DAYS, type InsightsRange } from "./range";
import { computeConsistencyGrid, CONSISTENCY_GRID_MAX_DAYS } from "./consistency";
import { computeNeglectRadar, type NeglectFixture } from "./neglect";
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
      select: { id: true, scheduleType: true, scheduleWeekdays: true, scheduleIntervalN: true, scheduleAnchorDate: true },
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
      select: { date: true, amount: true, direction: true },
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
      },
    })),
    checkIns,
    tasks: tasks.filter((t): t is { dueDate: Date; completedAt: Date | null } => t.dueDate !== null),
    transactions: transactions.map((t) => ({ date: t.date, amount: t.amount.toNumber(), direction: t.direction })),
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
};

/** Every KPI computed over the page's actual selected range (and the
 * equal-length period before it) — unlike Momentum, these do respond to
 * the range control, per the Insights header's "in production it must
 * drive every module." */
export async function getKpiSummary(range: InsightsRange, asOf: Date = new Date()): Promise<KpiSummary> {
  const { current, previous } = insightsWindows(range, asOf);
  const lookbackStart = previous[0];

  const [habits, checkIns, tasks, transactions, goals] = await Promise.all([
    prisma.habit.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true, scheduleType: true, scheduleWeekdays: true, scheduleIntervalN: true, scheduleAnchorDate: true },
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
      select: { date: true, amount: true, direction: true, category: true },
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
  ]);

  const habitFixtures = habits.map((h) => ({
    id: h.id,
    name: h.name,
    schedule: { scheduleType: h.scheduleType, scheduleWeekdays: h.scheduleWeekdays, scheduleIntervalN: h.scheduleIntervalN, scheduleAnchorDate: h.scheduleAnchorDate },
  }));

  const taskFixtures = tasks
    .filter((t): t is typeof t & { dueDate: Date } => t.dueDate !== null)
    .map((t) => ({ dueDate: t.dueDate, completedAt: t.completedAt, listName: t.list?.name ?? null }));

  const transactionFixtures = transactions.map((t) => ({ date: t.date, amount: t.amount.toNumber(), direction: t.direction, category: t.category }));

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

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

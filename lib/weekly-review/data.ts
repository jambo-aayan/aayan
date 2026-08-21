import "server-only";
import { prisma } from "@/lib/prisma";
import { resolveColorHex, type ColorKey } from "@/lib/colors";
import { sortByStaleness, reconcileRankOrder } from "./pure";
import { computeConsistencyGrid, type ConsistencyHabitFixture } from "@/lib/insights/consistency";
import { getKpiSummary, getWeeklyDigest } from "@/lib/insights/data";
import { insightsWindows } from "@/lib/insights/range";
import type { ReviewVerdict } from "./session";

const DAY_MS = 24 * 60 * 60 * 1000;

function utcMidnight(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

// --- Step 1: Close out ---

export type StaleTask = { id: string; title: string; listName: string | null; dueLabel: string; done: boolean };

function formatDueLabel(dueDate: Date | null): string {
  if (!dueDate) return "No date";
  return dueDate.toISOString().slice(0, 10);
}

export async function getStaleTasks(asOf: Date = new Date()): Promise<StaleTask[]> {
  const today = utcMidnight(asOf);
  const tasks = await prisma.task.findMany({
    where: { status: "ACTIVE", deletedAt: null, archivedAt: null },
    select: { id: true, title: true, dueDate: true, list: { select: { name: true } } },
  });
  const sorted = sortByStaleness(tasks, today).slice(0, 5);
  return sorted.map((t) => ({ id: t.id, title: t.title, listName: t.list?.name ?? null, dueLabel: formatDueLabel(t.dueDate), done: false }));
}

// --- Step 2: Habits ---

export type HabitReviewCard = {
  id: string;
  name: string;
  pillarName: string;
  pillarColor: string | null;
  adherencePct: number;
  cells: ("full" | "partial" | "none")[];
  verdict: ReviewVerdict | null;
};

export async function getHabitReviewCards(verdicts: Record<string, ReviewVerdict>, asOf: Date = new Date()): Promise<HabitReviewCard[]> {
  const today = utcMidnight(asOf);
  const start = new Date(today.getTime() - 13 * DAY_MS);

  const habits = await prisma.habit.findMany({
    where: { status: { in: ["ACTIVE", "PAUSED"] } },
    select: {
      id: true,
      name: true,
      scheduleType: true,
      scheduleWeekdays: true,
      scheduleIntervalN: true,
      scheduleAnchorDate: true,
      pillar: { select: { name: true, color: true } },
      checkIns: { where: { date: { gte: start, lte: today } }, select: { date: true, level: true } },
    },
  });

  const fixtures: ConsistencyHabitFixture[] = habits.map((h) => ({
    id: h.id,
    name: h.name,
    schedule: { scheduleType: h.scheduleType, scheduleWeekdays: h.scheduleWeekdays, scheduleIntervalN: h.scheduleIntervalN, scheduleAnchorDate: h.scheduleAnchorDate },
    checkIns: h.checkIns,
  }));

  const grid = computeConsistencyGrid(fixtures, start, today);
  const habitById = new Map(habits.map((h) => [h.id, h]));

  return grid.rows.map((row) => {
    const habit = habitById.get(row.habitId)!;
    return {
      id: row.habitId,
      name: row.habitName,
      pillarName: habit.pillar.name,
      pillarColor: resolveColorHex(habit.pillar.color as ColorKey | null),
      adherencePct: row.pct,
      cells: row.cells,
      verdict: verdicts[row.habitId] ?? null,
    };
  });
}

// --- Step 3: Re-rank ---

export type RankCandidate = { id: string; title: string; meta: string };

const RANK_CANDIDATE_POOL_SIZE = 8;

export async function getRankCandidates(savedOrder: string[], asOf: Date = new Date()): Promise<RankCandidate[]> {
  const today = utcMidnight(asOf);
  const twoWeeksOut = new Date(today.getTime() + 14 * DAY_MS);

  const tasks = await prisma.task.findMany({
    where: {
      status: "ACTIVE",
      deletedAt: null,
      archivedAt: null,
      OR: [{ important: true }, { dueDate: { lte: twoWeeksOut } }],
    },
    orderBy: [{ important: "desc" }, { dueDate: "asc" }],
    take: RANK_CANDIDATE_POOL_SIZE,
    select: { id: true, title: true, dueDate: true, list: { select: { name: true } } },
  });

  const candidatesById = new Map(
    tasks.map((t) => [
      t.id,
      { id: t.id, title: t.title, meta: [t.list?.name, t.dueDate ? t.dueDate.toISOString().slice(0, 10) : null].filter(Boolean).join(" · ") },
    ])
  );

  const orderedIds = reconcileRankOrder(savedOrder, [...candidatesById.keys()]);
  return orderedIds.map((id) => candidatesById.get(id)!).filter(Boolean);
}

// --- Step 4: Numbers ---

export type ReviewStat = { label: string; value: string; delta: string; note: string };

export async function getReviewNumbers(asOf: Date = new Date()): Promise<ReviewStat[]> {
  const { current, previous } = insightsWindows("7d", asOf);

  const [kpis, closedThisWeek, closedLastWeek, painThisWeek, painLastWeek] = await Promise.all([
    getKpiSummary("7d", asOf),
    prisma.task.count({ where: { completedAt: { gte: current[0], lte: current[1] } } }),
    prisma.task.count({ where: { completedAt: { gte: previous[0], lte: previous[1] } } }),
    prisma.painMobilityLog.findMany({ where: { date: { gte: current[0], lte: current[1] } }, select: { pain: true } }),
    prisma.painMobilityLog.findMany({ where: { date: { gte: previous[0], lte: previous[1] } }, select: { pain: true } }),
  ]);

  const avgPain = (logs: { pain: number }[]) => (logs.length === 0 ? null : logs.reduce((s, l) => s + l.pain, 0) / logs.length);
  const painNow = avgPain(painThisWeek);
  const painThen = avgPain(painLastWeek);
  const painDelta = painNow !== null && painThen !== null ? Math.round((painNow - painThen) * 10) / 10 : null;

  return [
    {
      label: "Adherence",
      value: `${kpis.adherence.value}%`,
      delta: `${kpis.adherence.delta >= 0 ? "+" : ""}${kpis.adherence.delta}`,
      note: kpis.adherence.diagnosis,
    },
    {
      label: "Tasks closed",
      value: `${closedThisWeek}`,
      delta: `${closedThisWeek - closedLastWeek >= 0 ? "+" : ""}${closedThisWeek - closedLastWeek}`,
      note: "vs. last week",
    },
    {
      label: "Surplus",
      value: `${kpis.surplusRate.value}%`,
      delta: `${kpis.surplusRate.delta >= 0 ? "+" : ""}${kpis.surplusRate.delta}`,
      note: kpis.surplusRate.diagnosis,
    },
    {
      label: "Pain average",
      value: painNow === null ? "—" : `${painNow.toFixed(1)}`,
      delta: painDelta === null ? "—" : `${painDelta >= 0 ? "+" : ""}${painDelta}`,
      note: painNow === null ? "No pain logs this week." : "vs. last week",
    },
  ];
}

// --- Step 5: Write it ---

export async function getReviewDigestDraft(asOf: Date = new Date()): Promise<string> {
  const digest = await getWeeklyDigest(asOf);
  const paragraphs = [...digest.worked, ...digest.slipped, digest.surprising, digest.oneThing];
  return paragraphs.join(" ");
}

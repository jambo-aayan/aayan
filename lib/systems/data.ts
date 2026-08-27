import "server-only";
import { prisma } from "@/lib/prisma";
import { sortRollup, timelineBar, describeLoad, type SystemType, type SystemState, type SystemVerdict } from "./logic";

const SYSTEM_INCLUDE = {
  steps: {
    orderBy: { sortOrder: "asc" as const },
    include: { occurrences: { orderBy: { occurredOn: "asc" as const } } },
  },
  children: { select: { id: true, name: true, state: true } },
  parent: { select: { id: true, name: true } },
  runs: {
    orderBy: { createdAt: "desc" as const },
    include: { steps: { select: { rating: true, done: true } } },
  },
  decisions: { orderBy: { when: "desc" as const } },
  evaluations: { orderBy: { date: "desc" as const } },
  habits: {
    include: {
      habit: { select: { id: true, name: true, status: true, checkIns: { select: { date: true } } } },
    },
  },
  goals: {
    include: { goal: { select: { id: true, name: true, status: true } } },
  },
};

type RawSystem = Awaited<ReturnType<typeof prisma.system.findFirstOrThrow<{ include: typeof SYSTEM_INCLUDE }>>>;

/** Flattens the SystemHabit/SystemGoal join rows into the plain
 * `linkedHabits`/`linkedGoals` shape components consume — everything
 * else on the row already matches its column names 1:1. */
function mapSystem(row: RawSystem) {
  const { habits, goals, ...rest } = row;
  return {
    ...rest,
    linkedHabits: habits.map((h) => ({
      id: h.habit.id,
      name: h.habit.name,
      status: h.habit.status,
      checkInDates: h.habit.checkIns.map((c) => c.date),
    })),
    linkedGoals: goals.map((g) => ({ id: g.goal.id, name: g.goal.name, status: g.goal.status })),
  };
}

export type SystemWithSteps = ReturnType<typeof mapSystem>;

/** Children sort immediately after their parent rather than wherever
 * createdAt puts them — a parent's "Inside this" list and a child's own
 * card should read together, not scattered through the list by age. */
function groupByParent<T extends { id: string; parentId: string | null }>(systems: T[]): T[] {
  const ids = new Set(systems.map((s) => s.id));
  const byParent = new Map<string | null, T[]>();
  for (const system of systems) {
    // A parentId pointing outside this result set (nesting is meant to be
    // same-scope, but nothing in the schema enforces that) is treated as
    // unparented here rather than silently dropped — every system in the
    // input always appears somewhere in the output.
    const key = system.parentId !== null && ids.has(system.parentId) ? system.parentId : null;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(system);
  }
  const ordered: T[] = [];
  for (const system of byParent.get(null) ?? []) {
    ordered.push(system, ...(byParent.get(system.id) ?? []));
  }
  return ordered;
}

export async function getSystemsForArea(areaId: string) {
  const systems = await prisma.system.findMany({
    where: { areaId, templateId: null },
    include: SYSTEM_INCLUDE,
    orderBy: { createdAt: "asc" },
  });
  return groupByParent(systems.map(mapSystem));
}

export async function getSystemsForPillar(pillarId: string) {
  const systems = await prisma.system.findMany({
    where: { pillarId, areaId: null, templateId: null },
    include: SYSTEM_INCLUDE,
    orderBy: { createdAt: "asc" },
  });
  return groupByParent(systems.map(mapSystem));
}

export async function getSystem(id: string) {
  const system = await prisma.system.findUnique({ where: { id }, include: SYSTEM_INCLUDE });
  return system ? mapSystem(system) : null;
}

/** A System's full evaluation history, most recent first — the System
 * card's trend view and the "last entry" staleness check both read off
 * this same ordering. */
export async function getSystemEvaluations(systemId: string) {
  return prisma.systemEvaluation.findMany({ where: { systemId }, orderBy: { date: "desc" } });
}

/** Habits within the System's own Pillar — a System only serves Habits it
 * shares a Pillar with, same scoping as Habit<->LifeGoal linkage. */
export async function getHabitOptionsForPillar(pillarId: string) {
  return prisma.habit.findMany({
    where: { pillarId, status: { in: ["ACTIVE", "PAUSED"] } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

export type UpcomingSystemStep = {
  id: string;
  text: string;
  date: Date;
  systemId: string;
  systemName: string;
  areaId: string | null;
  pillarId: string;
};

/** Dated steps (a Checkpoint target date or a Dated milestone) approaching
 * within `withinDays`, for My Day's Upcoming section — reusing the same
 * due-date surface Tasks already use, not a new reminder mechanism
 * (DATA_MODEL.md §5). */
export async function getUpcomingSystemSteps(from: Date, withinDays: number): Promise<UpcomingSystemStep[]> {
  const until = new Date(from);
  until.setDate(until.getDate() + withinDays);

  const steps = await prisma.systemStep.findMany({
    where: {
      done: false,
      OR: [
        { type: "CHECKPOINT", targetDate: { gte: from, lte: until } },
        { type: "MILESTONE", date: { gte: from, lte: until } },
      ],
    },
    include: { system: { select: { id: true, name: true, areaId: true, pillarId: true } } },
    orderBy: { sortOrder: "asc" },
  });

  return steps
    .map((s) => ({
      id: s.id,
      text: s.text,
      date: (s.targetDate ?? s.date)!,
      systemId: s.system.id,
      systemName: s.system.name,
      areaId: s.system.areaId,
      pillarId: s.system.pillarId,
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

export type AreaLoadRow = { id: string; name: string; count: number };

export type RollupRow = {
  id: string;
  name: string;
  type: SystemType;
  state: SystemState;
  areaId: string | null;
  areaName: string | null;
  pillarId: string;
  review: Date | null;
  verdict: SystemVerdict | null;
  stepsDone: number;
  totalSteps: number;
};

export type TimelineRow = { id: string; name: string; type: SystemType; endOffsetDays: number | null };

export type WhatWorkedRow = {
  id: string;
  name: string;
  verdict: SystemVerdict;
  criteria: string | null;
  runOutcome: string | null;
  updatedAt: Date;
};

export type SystemsOverview = {
  areaLoad: AreaLoadRow[];
  loadSummary: string | null;
  timeline: TimelineRow[];
  rollup: RollupRow[];
  whatWorked: WhatWorkedRow[];
};

const OVERVIEW_SELECT = {
  id: true,
  name: true,
  type: true,
  state: true,
  areaId: true,
  area: { select: { name: true } },
  pillarId: true,
  review: true,
  verdict: true,
  criteria: true,
  runOutcome: true,
  updatedAt: true,
  steps: { select: { done: true } },
};

/** The Systems tab's cross-cutting data: load per Area (including Areas at
 * zero), the "everything running" timeline, the attention-sorted rollup,
 * and the "What worked" verdict list — all computed here so the pure
 * ordering/formatting functions in logic.ts stay unaware of Prisma
 * (DATA_MODEL.md §5). Template rows (`isTemplate`) and their runs
 * (`templateId` set) are both real Systems and appear like any other;
 * only actual run copies would double-count a template's own progress,
 * and runs already have their own dedicated Runs section on the card. */
export async function getSystemsOverview(today: Date): Promise<SystemsOverview> {
  const [areas, systems] = await Promise.all([
    prisma.area.findMany({ select: { id: true, name: true } }),
    prisma.system.findMany({ where: { templateId: null }, select: OVERVIEW_SELECT, orderBy: { createdAt: "asc" } }),
  ]);

  const areaLoad: AreaLoadRow[] = areas.map((area) => ({
    id: area.id,
    name: area.name,
    count: systems.filter((s) => s.areaId === area.id && s.state === "ACTIVE").length,
  }));
  const loadSummary = describeLoad(areaLoad);

  const active = systems.filter((s) => s.state === "ACTIVE");
  const timeline: TimelineRow[] = active.map((s) => ({
    id: s.id,
    name: s.name,
    type: s.type,
    endOffsetDays: timelineBar({ id: s.id, type: s.type, review: s.review }, today).endOffsetDays,
  }));

  const rollupRows: RollupRow[] = systems.map((s) => ({
    id: s.id,
    name: s.name,
    type: s.type,
    state: s.state,
    areaId: s.areaId,
    areaName: s.area?.name ?? null,
    pillarId: s.pillarId,
    review: s.review,
    verdict: s.verdict,
    stepsDone: s.steps.filter((step) => step.done).length,
    totalSteps: s.steps.length,
  }));
  const rollup = sortRollup(rollupRows, today);

  const whatWorked: WhatWorkedRow[] = systems
    .filter((s): s is typeof s & { verdict: SystemVerdict } => s.verdict !== null)
    .map((s) => ({ id: s.id, name: s.name, verdict: s.verdict, criteria: s.criteria, runOutcome: s.runOutcome, updatedAt: s.updatedAt }))
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

  return { areaLoad, loadSummary, timeline, rollup, whatWorked };
}

import "server-only";
import { prisma } from "@/lib/prisma";
import { dailyStreak, mondayOf } from "@/lib/habits/streak";
import { habitOccursOn } from "@/lib/habits/schedule";
import { BASELINE_ID } from "@/lib/finance/baseline-id";
import { APP_SETTINGS_ID } from "@/lib/settings/constants";
import {
  evaluateEligibility,
  reEvaluateSnoozed,
  type NudgeRunKind,
  type DeliveryRules,
  type HabitEligibilityFixture,
  type TaskEligibilityFixture,
  type MetricEligibilityFixture,
  type ExistingNudgeFixture,
  type EligibleTargetFixture,
} from "./eligibility";
import type { NudgeCandidate } from "./types";

function utcMidnight(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

// The delivery-rule toggles live on AppSettings today only as reduceMotion/
// emptyAppMode/weeklyReviewPrompt (see lib/settings) — morning brief,
// evening check-in and streak warnings don't have a settings UI yet
// (that's #79's "delivery-rule toggles" scope), so they default on here.
async function getDeliveryRules(): Promise<DeliveryRules> {
  const settings = await prisma.appSettings.findUnique({ where: { id: APP_SETTINGS_ID } });
  return {
    morningBrief: true,
    eveningCheckIn: true,
    streakWarnings: true,
    weeklyReviewPrompt: settings?.weeklyReviewPrompt ?? true,
  };
}

async function getHabitFixtures(today: Date): Promise<HabitEligibilityFixture[]> {
  const habits = await prisma.habit.findMany({
    where: { status: "ACTIVE" },
    select: {
      id: true,
      name: true,
      scheduleType: true,
      scheduleWeekdays: true,
      scheduleIntervalN: true,
      scheduleAnchorDate: true,
      checkIns: { select: { date: true, level: true } },
    },
  });

  return habits.map((h) => {
    const checkInDates = h.checkIns.map((c) => c.date);
    const weekStart = mondayOf(today).getTime();
    const doneThisWeek = checkInDates.some((d) => mondayOf(d).getTime() === weekStart);
    const scheduledToday = habitOccursOn(
      { scheduleType: h.scheduleType, scheduleWeekdays: h.scheduleWeekdays, scheduleIntervalN: h.scheduleIntervalN, scheduleAnchorDate: h.scheduleAnchorDate },
      today,
      doneThisWeek
    );
    const checkedInToday = h.checkIns.some((c) => utcMidnight(c.date).getTime() === today.getTime());
    return { id: h.id, name: h.name, scheduledToday, checkedInToday, streakDays: dailyStreak(checkInDates) };
  });
}

async function getOverdueTaskFixtures(today: Date): Promise<TaskEligibilityFixture[]> {
  const tasks = await prisma.task.findMany({
    where: { status: "ACTIVE", deletedAt: null, archivedAt: null, dueDate: { lt: today } },
    select: { id: true, title: true },
  });
  return tasks;
}

async function getTopTaskFixtures(today: Date): Promise<TaskEligibilityFixture[]> {
  const tasks = await prisma.task.findMany({
    where: { status: "ACTIVE", deletedAt: null, archivedAt: null, dueDate: today },
    orderBy: [{ important: "desc" }, { sortOrder: "asc" }],
    take: 3,
    select: { id: true, title: true },
  });
  return tasks;
}

/** Surplus vs the Finance Baseline over the current calendar month — the
 * one metric this ticket wires up (see the design_handoff_aayan README's
 * "surplus / adherence below baseline" trigger). A per-pillar adherence
 * baseline doesn't exist as a concept yet, so that half is left for a
 * later ticket rather than invented here. */
async function getMetricFixtures(today: Date): Promise<MetricEligibilityFixture[]> {
  const baseline = await prisma.baseline.findUnique({ where: { id: BASELINE_ID } });
  if (!baseline || baseline.monthlyIncome.toNumber() <= 0) return [];

  const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const transactions = await prisma.transaction.findMany({
    where: { date: { gte: monthStart, lte: today } },
    select: { amount: true, direction: true },
  });
  const income = transactions.filter((t) => t.direction === "IN").reduce((sum, t) => sum + t.amount.toNumber(), 0);
  const outgoings = transactions.filter((t) => t.direction === "OUT").reduce((sum, t) => sum + t.amount.toNumber(), 0);
  if (income <= 0) return [];

  const valuePct = Math.max(0, Math.min(100, ((income - outgoings) / income) * 100));
  const monthlyIncome = baseline.monthlyIncome.toNumber();
  const baselinePct = Math.max(0, Math.min(100, ((monthlyIncome - baseline.fixedOutgoings.toNumber()) / monthlyIncome) * 100));

  return [{ key: "surplus", label: "Surplus", valuePct, baselinePct }];
}

async function getExistingNudgesToday(now: Date): Promise<ExistingNudgeFixture[]> {
  const todayStart = utcMidnight(now);
  const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
  const rows = await prisma.nudge.findMany({
    where: { createdAt: { gte: todayStart, lt: tomorrowStart } },
    select: { dedupKey: true, severity: true },
  });
  return rows;
}

async function persistCandidates(candidates: NudgeCandidate[], now: Date): Promise<void> {
  for (const candidate of candidates) {
    await prisma.nudge.upsert({
      where: { dedupKey: candidate.dedupKey },
      create: {
        dedupKey: candidate.dedupKey,
        type: candidate.type,
        severity: candidate.severity,
        targetType: candidate.targetType,
        targetId: candidate.targetId,
        title: candidate.title,
        body: candidate.body,
      },
      update: {
        type: candidate.type,
        severity: candidate.severity,
        targetType: candidate.targetType,
        targetId: candidate.targetId,
        title: candidate.title,
        body: candidate.body,
        readAt: null,
        createdAt: now,
      },
    });
  }
}

/** Re-checks every snoozed Nudge whose snooze has woken, resolving
 * (marking read) anything no longer eligible and clearing `snoozedUntil`
 * on anything that is — see reEvaluateSnoozed's doc comment for why this
 * matches by entity, not by the (date-scoped) dedupKey. */
async function reEvaluateSnoozes(now: Date, habits: HabitEligibilityFixture[], overdueTasks: TaskEligibilityFixture[]): Promise<void> {
  const snoozed = await prisma.nudge.findMany({
    where: { snoozedUntil: { not: null, lte: now }, readAt: null },
    select: { id: true, type: true, targetType: true, targetId: true, snoozedUntil: true },
  });
  if (snoozed.length === 0) return;

  const stillEligible: EligibleTargetFixture[] = [
    ...overdueTasks.map((t): EligibleTargetFixture => ({ type: "TASK_OVERDUE", targetType: "TASK", targetId: t.id })),
    ...habits
      .filter((h) => h.scheduledToday && !h.checkedInToday)
      .map((h): EligibleTargetFixture => ({ type: h.streakDays > 7 ? "STREAK_AT_RISK" : "HABIT_DUE", targetType: "HABIT", targetId: h.id })),
  ];

  const decisions = reEvaluateSnoozed(
    snoozed.map((n) => ({ id: n.id, type: n.type, targetType: n.targetType, targetId: n.targetId, snoozedUntil: n.snoozedUntil! })),
    now,
    stillEligible
  );

  for (const decision of decisions) {
    if (decision.action === "unsnooze") {
      await prisma.nudge.update({ where: { id: decision.id }, data: { snoozedUntil: null } });
    } else {
      await prisma.nudge.update({ where: { id: decision.id }, data: { readAt: now } });
    }
  }
}

/** The scheduled job's entry point — see app/api/cron/nudges/route.ts.
 * Fetches everything the pure eligibility engine needs, runs it, and
 * persists the result. Also re-evaluates woken snoozes on every run (not
 * just at specific times), since a snooze can wake at any wall-clock
 * moment. */
export async function runNudgeEvaluation(runKind: NudgeRunKind, now: Date = new Date()): Promise<{ delivered: number; held: boolean }> {
  const today = utcMidnight(now);
  const [deliveryRules, habits, overdueTasks, topTasks, metrics, existingNudgesToday] = await Promise.all([
    getDeliveryRules(),
    getHabitFixtures(today),
    getOverdueTaskFixtures(today),
    getTopTaskFixtures(today),
    getMetricFixtures(today),
    getExistingNudgesToday(now),
  ]);

  await reEvaluateSnoozes(now, habits, overdueTasks);

  const result = evaluateEligibility({
    now,
    runKind,
    deliveryRules,
    habits,
    overdueTasks,
    topTasks,
    metrics,
    existingNudgesToday,
  });

  await persistCandidates(result.deliver, now);
  return { delivered: result.deliver.length, held: result.held };
}

export type NudgeFilter = "unread" | "all" | "snoozed";

export async function getNudges(filter: NudgeFilter) {
  const now = new Date();
  const where =
    filter === "unread"
      ? { readAt: null, OR: [{ snoozedUntil: null }, { snoozedUntil: { lte: now } }] }
      : filter === "snoozed"
        ? { snoozedUntil: { not: null, gt: now }, readAt: null }
        : {};

  const rows = await prisma.nudge.findMany({ where, orderBy: { createdAt: "desc" }, take: 100 });
  return rows;
}

/** Badge count: all unread, undifferentiated (ADR-0002) — but excluding
 * anything currently snoozed. Snoozing is a deliberate "not now"; counting
 * a snoozed item toward the badge would immediately re-nag the moment you
 * dismiss it, which defeats the point of snoozing. Not addressed
 * explicitly by the ADR — see docs/adr/0002 and the README's open
 * question #5 — so this is this ticket's call, documented here rather
 * than silently baked in. */
export async function getUnreadNudgeCount(): Promise<number> {
  const now = new Date();
  return prisma.nudge.count({ where: { readAt: null, OR: [{ snoozedUntil: null }, { snoozedUntil: { lte: now } }] } });
}

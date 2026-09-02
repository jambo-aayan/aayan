import { formatGBP } from "../finance/format";
import { NUDGE_SEVERITY, type NudgeCandidate, type NudgeType, type NudgeTargetType } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

export type NudgeRunKind = "MORNING" | "EVENING" | "WEEKLY_REVIEW";

export type DeliveryRules = {
  morningBrief: boolean;
  eveningCheckIn: boolean;
  streakWarnings: boolean;
  weeklyReviewPrompt: boolean;
};

export type HabitEligibilityFixture = {
  id: string;
  name: string;
  scheduledToday: boolean;
  checkedInToday: boolean;
  /** Whether skipping today would put a meaningful streak at risk —
   * precomputed by the caller via lib/habits/schedule.ts's
   * isStreakAtRisk, which knows how to judge this per schedule type (a
   * PER_WEEK habit's "at risk" isn't a daily-consecutive streak — see
   * that function's own doc comment, #126/ADR-0011). */
  atRisk: boolean;
};

export type TaskEligibilityFixture = {
  id: string;
  title: string;
};

export type MetricEligibilityFixture = {
  key: string;
  label: string;
  valuePct: number;
  baselinePct: number;
};

export type SystemReviewEligibilityFixture = {
  /** The eligible System's own id — a run's own id, not its template's
   * (docs/adr/0009-systems-review-nudges.md). */
  id: string;
  /** A run's `name` is copied straight from its template at creation, so
   * it can't distinguish one run from another on its own — `startedOn`
   * (below) is what the title uses to disambiguate when `isRun`. */
  name: string;
  isRun: boolean;
  startedOn: Date;
};

export type ExistingNudgeFixture = {
  dedupKey: string;
  severity: number;
};

/** A leaf category whose current-month spend is notably above its own
 * trailing-3-month baseline (ADR-0012's categorySpendDeviation) — the
 * caller (lib/nudges/data.ts) pre-filters to `callout: "more"` only,
 * since this nudge is about overspending, not celebrating an
 * underspend. */
export type CategorySpendEligibilityFixture = {
  category: string;
  categoryParent: string;
  current: number;
  baseline: number;
  diffPercent: number;
};

export type NudgeContext = {
  now: Date;
  runKind: NudgeRunKind;
  deliveryRules: DeliveryRules;
  habits: HabitEligibilityFixture[];
  overdueTasks: TaskEligibilityFixture[];
  topTasks: TaskEligibilityFixture[];
  metrics: MetricEligibilityFixture[];
  dueSystemReviews: SystemReviewEligibilityFixture[];
  categorySpendAnomalies: CategorySpendEligibilityFixture[];
  existingNudgesToday: ExistingNudgeFixture[];
};

export type EligibilityResult = {
  /** Candidates to actually create/upgrade this run. Empty during quiet
   * hours or when a run's relevant delivery rules are all off. */
  deliver: NudgeCandidate[];
  /** True when `now` fell in the 22:00–07:30 quiet window — nothing is
   * delivered this run by design (see ADR-0002); the next scheduled run
   * outside the window re-evaluates real state from scratch and delivers
   * it as one coalesced batch, so nothing held is lost, only delayed. */
  held: boolean;
};

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function isoWeekKey(date: Date): string {
  // Monday-anchored week key, coarse enough that "one per week" dedup
  // doesn't need the full mondayOf() machinery from lib/habits/streak.ts.
  const day = date.getUTCDay();
  const daysSinceMonday = day === 0 ? 6 : day - 1;
  const monday = new Date(date.getTime() - daysSinceMonday * DAY_MS);
  return dateKey(monday);
}

/** 22:00–07:30, evaluated against `now`'s UTC wall-clock hour/minute — the
 * app treats UTC as the user's local time throughout (see e.g. Task's
 * dueDate convention), so this follows the same rule rather than adding a
 * timezone dependency nothing else in the app has. */
export function isQuietHours(now: Date): boolean {
  const minutesSinceMidnight = now.getUTCHours() * 60 + now.getUTCMinutes();
  return minutesSinceMidnight >= 22 * 60 || minutesSinceMidnight < 7 * 60 + 30;
}

function generateCandidates(ctx: NudgeContext): NudgeCandidate[] {
  const today = dateKey(ctx.now);
  const candidates: NudgeCandidate[] = [];

  if (ctx.runKind === "MORNING" && ctx.deliveryRules.morningBrief) {
    const dueHabits = ctx.habits.filter((h) => h.scheduledToday && !h.checkedInToday);
    if (dueHabits.length > 0 || ctx.topTasks.length > 0) {
      const taskNames = ctx.topTasks.slice(0, 3).map((t) => t.title);
      candidates.push({
        dedupKey: `brief:${today}`,
        type: "MORNING_BRIEF",
        severity: NUDGE_SEVERITY.MORNING_BRIEF,
        targetType: "NONE",
        targetId: null,
        title: "Today's brief",
        body:
          dueHabits.length > 0 && taskNames.length > 0
            ? `${dueHabits.length} habit${dueHabits.length === 1 ? "" : "s"} due today. Top tasks: ${taskNames.join(", ")}.`
            : dueHabits.length > 0
              ? `${dueHabits.length} habit${dueHabits.length === 1 ? "" : "s"} due today.`
              : `Top tasks: ${taskNames.join(", ")}.`,
      });
    }
  }

  if (ctx.runKind === "EVENING") {
    if (ctx.deliveryRules.eveningCheckIn) {
      for (const habit of ctx.habits) {
        if (!habit.scheduledToday || habit.checkedInToday) continue;
        candidates.push({
          dedupKey: `habit:${habit.id}:${today}`,
          type: "HABIT_DUE",
          severity: NUDGE_SEVERITY.HABIT_DUE,
          targetType: "HABIT",
          targetId: habit.id,
          title: `${habit.name} is due`,
          body: "Still unlogged today — a quick check-in keeps it on track.",
        });
      }
    }
    if (ctx.deliveryRules.streakWarnings) {
      for (const habit of ctx.habits) {
        if (!habit.scheduledToday || habit.checkedInToday) continue;
        if (!habit.atRisk) continue;
        candidates.push({
          dedupKey: `habit:${habit.id}:${today}`,
          type: "STREAK_AT_RISK",
          severity: NUDGE_SEVERITY.STREAK_AT_RISK,
          targetType: "HABIT",
          targetId: habit.id,
          title: `${habit.name}'s streak is at risk`,
          body: "Unlogged and getting late — check in to keep the streak alive.",
        });
      }
    }
  }

  if (ctx.runKind === "MORNING" || ctx.runKind === "EVENING") {
    for (const task of ctx.overdueTasks) {
      candidates.push({
        dedupKey: `task:${task.id}:${today}`,
        type: "TASK_OVERDUE",
        severity: NUDGE_SEVERITY.TASK_OVERDUE,
        targetType: "TASK",
        targetId: task.id,
        title: `"${task.title}" is overdue`,
        body: "Past its due date and not done yet.",
      });
    }
  }

  if (ctx.runKind === "MORNING") {
    for (const metric of ctx.metrics) {
      if (metric.valuePct >= metric.baselinePct) continue;
      candidates.push({
        dedupKey: `metric:${metric.key}:${today}`,
        type: "METRIC_OFF_TARGET",
        severity: NUDGE_SEVERITY.METRIC_OFF_TARGET,
        targetType: "NONE",
        targetId: null,
        title: `${metric.label} is below target`,
        body: `${Math.round(metric.valuePct)}% vs a ${Math.round(metric.baselinePct)}% baseline.`,
      });
    }
  }

  if (ctx.runKind === "MORNING") {
    for (const review of ctx.dueSystemReviews) {
      candidates.push({
        dedupKey: `system-review:${review.id}:${today}`,
        type: "SYSTEM_REVIEW_DUE",
        severity: NUDGE_SEVERITY.SYSTEM_REVIEW_DUE,
        targetType: "SYSTEM",
        targetId: review.id,
        title: review.isRun
          ? `"${review.name}" (started ${dateKey(review.startedOn)}) is ready for a verdict`
          : `"${review.name}" is ready for a verdict`,
        body: "Its review date has arrived — decide whether to continue, escalate, or stop.",
      });
    }
  }

  if (ctx.runKind === "MORNING") {
    for (const anomaly of ctx.categorySpendAnomalies) {
      candidates.push({
        dedupKey: `category-spend:${anomaly.categoryParent}:${anomaly.category}:${today}`,
        type: "CATEGORY_SPEND_ANOMALY",
        severity: NUDGE_SEVERITY.CATEGORY_SPEND_ANOMALY,
        targetType: "NONE",
        targetId: null,
        title: `${anomaly.categoryParent}: ${anomaly.category} is up this month`,
        body: `${formatGBP(anomaly.current, true)} so far, ${Math.round(anomaly.diffPercent)}% above your usual ${formatGBP(anomaly.baseline, true)}.`,
      });
    }
  }

  if (ctx.runKind === "WEEKLY_REVIEW" && ctx.deliveryRules.weeklyReviewPrompt) {
    candidates.push({
      dedupKey: `weekly-review:${isoWeekKey(ctx.now)}`,
      type: "WEEKLY_REVIEW_READY",
      severity: NUDGE_SEVERITY.WEEKLY_REVIEW_READY,
      targetType: "NONE",
      targetId: null,
      title: "Weekly review is ready",
      body: "Five steps, about six minutes.",
    });
  }

  return candidates;
}

/** Collapses candidates sharing a dedupKey down to the single
 * highest-severity one — this is what makes "streak-at-risk beats habit
 * due for the same habit/day" (ADR-0002) actually happen, since both are
 * generated with the same key above. */
function dedupBySeverity(candidates: NudgeCandidate[]): NudgeCandidate[] {
  const byKey = new Map<string, NudgeCandidate>();
  for (const candidate of candidates) {
    const existing = byKey.get(candidate.dedupKey);
    if (!existing || candidate.severity > existing.severity) byKey.set(candidate.dedupKey, candidate);
  }
  return [...byKey.values()];
}

/**
 * The whole ADR-0002 engine in one pure function: quiet-hour hold,
 * per-day per-target dedup by severity, morning-brief coalescing, and
 * idempotent-against-already-created-rows delivery — everything except
 * snooze re-evaluation, which is its own function below (it operates on a
 * different input shape: existing snoozed rows, not fresh candidates).
 */
export function evaluateEligibility(ctx: NudgeContext): EligibilityResult {
  if (isQuietHours(ctx.now)) return { deliver: [], held: true };

  const deduped = dedupBySeverity(generateCandidates(ctx));

  const existingByKey = new Map(ctx.existingNudgesToday.map((n) => [n.dedupKey, n]));
  const deliver = deduped.filter((candidate) => {
    const existing = existingByKey.get(candidate.dedupKey);
    // No row yet, or this run's candidate outranks what's already stored
    // (an upgrade, e.g. streak-at-risk superseding an earlier habit-due) —
    // deliver either way. Same-or-lower severity than what's already
    // there means a previous run already covered it; skip so reruns are
    // idempotent.
    return !existing || candidate.severity > existing.severity;
  });

  return { deliver, held: false };
}

export type SnoozedNudgeFixture = {
  id: string;
  type: NudgeType;
  targetType: NudgeTargetType;
  targetId: string | null;
  snoozedUntil: Date;
};

export type EligibleTargetFixture = { type: NudgeType; targetType: NudgeTargetType; targetId: string | null };

export type SnoozeReEvaluation = { id: string; action: "unsnooze" | "resolve" };

/** Snoozed rows are dedup-keyed to the *day they were created*
 * (`habit:<id>:2026-08-21`), so matching a wake-time re-check against that
 * exact key would always miss once the snooze crosses midnight — a task
 * snoozed today and waking tomorrow would never match tomorrow's freshly
 * date-keyed candidate even if it's still overdue. Match by entity
 * instead: (targetType, targetId) for anything with a real target, or
 * `type` alone for the NONE-targeted types (weekly review, morning brief,
 * metric off target), where there's no entity to key on. This also
 * correctly unsnoozes a habit that escalated from HABIT_DUE to
 * STREAK_AT_RISK while snoozed — same target, different type. */
function matchKey(f: { type: NudgeType; targetType: NudgeTargetType; targetId: string | null }): string {
  return f.targetType === "NONE" ? `type:${f.type}` : `target:${f.targetType}:${f.targetId}`;
}

/**
 * Snooze defers a check, it doesn't guarantee a future delivery regardless
 * of state (ADR-0002) — so on wake, each snoozed item is checked against
 * the current still-eligible set. Still eligible -> unsnooze (resurface
 * as unread). No longer eligible (e.g. the task got completed while
 * snoozed) -> resolve (mark read, never resurfaces).
 */
export function reEvaluateSnoozed(
  snoozed: SnoozedNudgeFixture[],
  now: Date,
  stillEligible: EligibleTargetFixture[]
): SnoozeReEvaluation[] {
  const eligibleKeys = new Set(stillEligible.map(matchKey));
  return snoozed
    .filter((n) => n.snoozedUntil.getTime() <= now.getTime())
    .map((n) => ({ id: n.id, action: eligibleKeys.has(matchKey(n)) ? "unsnooze" : "resolve" }));
}

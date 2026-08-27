import { describe, expect, it } from "vitest";
import { evaluateEligibility, isQuietHours, reEvaluateSnoozed, type NudgeContext, type DeliveryRules } from "./eligibility";

function d(iso: string): Date {
  return new Date(iso);
}

const ALL_ON: DeliveryRules = { morningBrief: true, eveningCheckIn: true, streakWarnings: true, weeklyReviewPrompt: true };

function baseCtx(overrides: Partial<NudgeContext> = {}): NudgeContext {
  return {
    now: d("2026-08-21T07:30:00.000Z"),
    runKind: "MORNING",
    deliveryRules: ALL_ON,
    habits: [],
    overdueTasks: [],
    topTasks: [],
    metrics: [],
    dueSystemReviews: [],
    existingNudgesToday: [],
    ...overrides,
  };
}

describe("isQuietHours", () => {
  it("is true from 22:00 up to (not including) 07:30", () => {
    expect(isQuietHours(d("2026-08-21T22:00:00.000Z"))).toBe(true);
    expect(isQuietHours(d("2026-08-21T23:59:00.000Z"))).toBe(true);
    expect(isQuietHours(d("2026-08-22T00:00:00.000Z"))).toBe(true);
    expect(isQuietHours(d("2026-08-22T07:29:00.000Z"))).toBe(true);
  });

  it("is false at exactly 07:30 and during the day", () => {
    expect(isQuietHours(d("2026-08-22T07:30:00.000Z"))).toBe(false);
    expect(isQuietHours(d("2026-08-22T12:00:00.000Z"))).toBe(false);
    expect(isQuietHours(d("2026-08-22T21:59:00.000Z"))).toBe(false);
  });
});

describe("evaluateEligibility — quiet-hour hold", () => {
  it("holds everything and delivers nothing when now is inside quiet hours", () => {
    const ctx = baseCtx({
      now: d("2026-08-21T23:00:00.000Z"),
      runKind: "EVENING",
      habits: [{ id: "h1", name: "Stretch", scheduledToday: true, checkedInToday: false, streakDays: 1 }],
    });
    const result = evaluateEligibility(ctx);
    expect(result.held).toBe(true);
    expect(result.deliver).toEqual([]);
  });

  it("does not hold at exactly the window's end (07:30)", () => {
    const ctx = baseCtx({ now: d("2026-08-21T07:30:00.000Z"), runKind: "MORNING", topTasks: [{ id: "t1", title: "Call the vet" }] });
    expect(evaluateEligibility(ctx).held).toBe(false);
  });
});

describe("evaluateEligibility — same-habit dedup by severity", () => {
  it("streak-at-risk supersedes habit-due for the same habit on the same day", () => {
    const ctx = baseCtx({
      runKind: "EVENING",
      habits: [{ id: "h1", name: "Journal", scheduledToday: true, checkedInToday: false, streakDays: 12 }],
    });
    const result = evaluateEligibility(ctx);
    const forHabit = result.deliver.filter((c) => c.dedupKey === "habit:h1:2026-08-21");
    expect(forHabit).toHaveLength(1);
    expect(forHabit[0].type).toBe("STREAK_AT_RISK");
  });

  it("falls back to habit-due when the streak isn't long enough to be at risk", () => {
    const ctx = baseCtx({
      runKind: "EVENING",
      habits: [{ id: "h1", name: "Journal", scheduledToday: true, checkedInToday: false, streakDays: 3 }],
    });
    const result = evaluateEligibility(ctx);
    const forHabit = result.deliver.filter((c) => c.dedupKey === "habit:h1:2026-08-21");
    expect(forHabit).toHaveLength(1);
    expect(forHabit[0].type).toBe("HABIT_DUE");
  });

  it("does not warn about a streak at risk once the habit is checked in", () => {
    const ctx = baseCtx({
      runKind: "EVENING",
      habits: [{ id: "h1", name: "Journal", scheduledToday: true, checkedInToday: true, streakDays: 20 }],
    });
    expect(evaluateEligibility(ctx).deliver).toEqual([]);
  });
});

describe("evaluateEligibility — morning brief coalescing", () => {
  it("produces exactly one MORNING_BRIEF candidate regardless of how many habits/tasks are due", () => {
    const ctx = baseCtx({
      runKind: "MORNING",
      habits: [
        { id: "h1", name: "Stretch", scheduledToday: true, checkedInToday: false, streakDays: 1 },
        { id: "h2", name: "Read", scheduledToday: true, checkedInToday: false, streakDays: 2 },
        { id: "h3", name: "Journal", scheduledToday: true, checkedInToday: false, streakDays: 3 },
      ],
      topTasks: [{ id: "t1", title: "Call the vet" }, { id: "t2", title: "Pay rent" }],
    });
    const result = evaluateEligibility(ctx);
    const briefs = result.deliver.filter((c) => c.type === "MORNING_BRIEF");
    expect(briefs).toHaveLength(1);
    expect(briefs[0].dedupKey).toBe("brief:2026-08-21");
  });

  it("produces no morning brief when nothing is due and morningBrief is off", () => {
    const onCtx = baseCtx({ runKind: "MORNING", habits: [], topTasks: [] });
    expect(evaluateEligibility(onCtx).deliver.filter((c) => c.type === "MORNING_BRIEF")).toHaveLength(0);

    const offCtx = baseCtx({
      runKind: "MORNING",
      deliveryRules: { ...ALL_ON, morningBrief: false },
      topTasks: [{ id: "t1", title: "Call the vet" }],
    });
    expect(evaluateEligibility(offCtx).deliver.filter((c) => c.type === "MORNING_BRIEF")).toHaveLength(0);
  });
});

describe("evaluateEligibility — delivery rule toggles", () => {
  it("suppresses HABIT_DUE and STREAK_AT_RISK when their rules are off", () => {
    const ctx = baseCtx({
      runKind: "EVENING",
      deliveryRules: { ...ALL_ON, eveningCheckIn: false, streakWarnings: false },
      habits: [{ id: "h1", name: "Journal", scheduledToday: true, checkedInToday: false, streakDays: 12 }],
    });
    expect(evaluateEligibility(ctx).deliver).toEqual([]);
  });

  it("suppresses WEEKLY_REVIEW_READY when weeklyReviewPrompt is off", () => {
    const ctx = baseCtx({ runKind: "WEEKLY_REVIEW", deliveryRules: { ...ALL_ON, weeklyReviewPrompt: false } });
    expect(evaluateEligibility(ctx).deliver).toEqual([]);
  });
});

describe("evaluateEligibility — task overdue and metric off target", () => {
  it("creates one TASK_OVERDUE candidate per overdue task", () => {
    const ctx = baseCtx({ overdueTasks: [{ id: "t1", title: "Renew passport" }, { id: "t2", title: "Book dentist" }] });
    const overdue = evaluateEligibility(ctx).deliver.filter((c) => c.type === "TASK_OVERDUE");
    expect(overdue.map((c) => c.targetId).sort()).toEqual(["t1", "t2"]);
  });

  it("flags a metric below its baseline, and not one that's at or above it", () => {
    const ctx = baseCtx({
      metrics: [
        { key: "surplus", label: "Surplus", valuePct: 10, baselinePct: 25 },
        { key: "adherence", label: "Adherence", valuePct: 80, baselinePct: 60 },
      ],
    });
    const flagged = evaluateEligibility(ctx).deliver.filter((c) => c.type === "METRIC_OFF_TARGET");
    expect(flagged).toHaveLength(1);
    expect(flagged[0].dedupKey).toBe("metric:surplus:2026-08-21");
  });
});

describe("evaluateEligibility — system review due", () => {
  it("creates one SYSTEM_REVIEW_DUE candidate per due review, targeting the System's own id", () => {
    const ctx = baseCtx({
      dueSystemReviews: [
        { id: "sys1", name: "Elimination diet", isRun: false, startedOn: d("2026-08-01") },
        { id: "run1", name: "Training block", isRun: true, startedOn: d("2026-07-15") },
      ],
    });
    const due = evaluateEligibility(ctx).deliver.filter((c) => c.type === "SYSTEM_REVIEW_DUE");
    expect(due.map((c) => c.targetId).sort()).toEqual(["run1", "sys1"]);
    expect(due.every((c) => c.targetType === "SYSTEM")).toBe(true);
    expect(due.every((c) => c.severity === 3)).toBe(true);
  });

  it("only evaluates on the morning run, matching TASK_OVERDUE's own cadence choice for this ticket", () => {
    const ctx = baseCtx({
      runKind: "EVENING",
      dueSystemReviews: [{ id: "sys1", name: "Elimination diet", isRun: false, startedOn: d("2026-08-01") }],
    });
    expect(evaluateEligibility(ctx).deliver.filter((c) => c.type === "SYSTEM_REVIEW_DUE")).toEqual([]);
  });

  it("dedup-keys per System id per day, independent of any other eligible review", () => {
    const ctx = baseCtx({
      dueSystemReviews: [{ id: "sys1", name: "Elimination diet", isRun: false, startedOn: d("2026-08-01") }],
    });
    const due = evaluateEligibility(ctx).deliver.filter((c) => c.type === "SYSTEM_REVIEW_DUE");
    expect(due[0].dedupKey).toBe("system-review:sys1:2026-08-21");
  });

  it("names the run's own start date in the title, distinguishing it from its template's own review nudge", () => {
    const ctx = baseCtx({
      dueSystemReviews: [{ id: "run1", name: "Training block", isRun: true, startedOn: d("2026-07-15") }],
    });
    const [candidate] = evaluateEligibility(ctx).deliver.filter((c) => c.type === "SYSTEM_REVIEW_DUE");
    expect(candidate.title).toContain("Training block");
    expect(candidate.title).toContain("2026-07-15");
  });
});

describe("evaluateEligibility — idempotent reruns", () => {
  it("does not redeliver a candidate already stored at the same severity", () => {
    const ctx = baseCtx({
      overdueTasks: [{ id: "t1", title: "Renew passport" }],
      existingNudgesToday: [{ dedupKey: "task:t1:2026-08-21", severity: 3 }],
    });
    expect(evaluateEligibility(ctx).deliver).toEqual([]);
  });

  it("delivers an upgrade when the new candidate outranks the stored severity", () => {
    const ctx = baseCtx({
      runKind: "EVENING",
      habits: [{ id: "h1", name: "Journal", scheduledToday: true, checkedInToday: false, streakDays: 12 }],
      existingNudgesToday: [{ dedupKey: "habit:h1:2026-08-21", severity: 1 }], // an earlier HABIT_DUE
    });
    const result = evaluateEligibility(ctx);
    expect(result.deliver).toHaveLength(1);
    expect(result.deliver[0].type).toBe("STREAK_AT_RISK");
  });
});

describe("reEvaluateSnoozed", () => {
  it("unsnoozes a task that's still overdue once its snooze wakes", () => {
    const result = reEvaluateSnoozed(
      [{ id: "n1", type: "TASK_OVERDUE", targetType: "TASK", targetId: "t1", snoozedUntil: d("2026-08-22T09:00:00.000Z") }],
      d("2026-08-22T10:00:00.000Z"),
      [{ type: "TASK_OVERDUE", targetType: "TASK", targetId: "t1" }]
    );
    expect(result).toEqual([{ id: "n1", action: "unsnooze" }]);
  });

  it("resolves a task snoozed until tomorrow that gets completed in the meantime — it should not resurface", () => {
    const result = reEvaluateSnoozed(
      [{ id: "n1", type: "TASK_OVERDUE", targetType: "TASK", targetId: "t1", snoozedUntil: d("2026-08-22T09:00:00.000Z") }],
      d("2026-08-22T10:00:00.000Z"),
      []
    );
    expect(result).toEqual([{ id: "n1", action: "resolve" }]);
  });

  it("ignores a snooze that hasn't woken yet", () => {
    const result = reEvaluateSnoozed(
      [{ id: "n1", type: "TASK_OVERDUE", targetType: "TASK", targetId: "t1", snoozedUntil: d("2026-08-23T09:00:00.000Z") }],
      d("2026-08-22T10:00:00.000Z"),
      [{ type: "TASK_OVERDUE", targetType: "TASK", targetId: "t1" }]
    );
    expect(result).toEqual([]);
  });

  it("still unsnoozes across a day boundary, since the still-eligible set is entity-keyed, not date-keyed", () => {
    // Snoozed while dedup-keyed to 2026-08-21; wakes and re-evaluates on 2026-08-22.
    const result = reEvaluateSnoozed(
      [{ id: "n1", type: "HABIT_DUE", targetType: "HABIT", targetId: "h1", snoozedUntil: d("2026-08-22T09:00:00.000Z") }],
      d("2026-08-22T10:00:00.000Z"),
      [{ type: "HABIT_DUE", targetType: "HABIT", targetId: "h1" }]
    );
    expect(result).toEqual([{ id: "n1", action: "unsnooze" }]);
  });

  it("unsnoozes even when the habit escalated from HABIT_DUE to STREAK_AT_RISK while snoozed", () => {
    const result = reEvaluateSnoozed(
      [{ id: "n1", type: "HABIT_DUE", targetType: "HABIT", targetId: "h1", snoozedUntil: d("2026-08-22T09:00:00.000Z") }],
      d("2026-08-22T10:00:00.000Z"),
      [{ type: "STREAK_AT_RISK", targetType: "HABIT", targetId: "h1" }]
    );
    expect(result).toEqual([{ id: "n1", action: "unsnooze" }]);
  });

  it("resolves a NONE-targeted snooze (e.g. weekly review) once its type is no longer eligible", () => {
    const result = reEvaluateSnoozed(
      [{ id: "n1", type: "WEEKLY_REVIEW_READY", targetType: "NONE", targetId: null, snoozedUntil: d("2026-08-23T19:00:00.000Z") }],
      d("2026-08-24T09:00:00.000Z"),
      []
    );
    expect(result).toEqual([{ id: "n1", action: "resolve" }]);
  });
});

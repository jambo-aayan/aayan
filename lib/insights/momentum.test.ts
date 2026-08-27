import { describe, expect, it } from "vitest";
import {
  adherenceForHabit,
  computeAdherence,
  computeMomentumMetrics,
  computeMomentumHistory,
  computeSurplusRate,
  momentumWindows,
  momentumWrittenRead,
  type MomentumInputs,
} from "./momentum";

function d(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

describe("momentumWindows", () => {
  it("returns two adjacent 28-day windows ending on asOf", () => {
    const { current, previous } = momentumWindows(d("2026-08-28"));
    expect(current[0].toISOString().slice(0, 10)).toBe("2026-08-01");
    expect(current[1].toISOString().slice(0, 10)).toBe("2026-08-28");
    expect(previous[1].toISOString().slice(0, 10)).toBe("2026-07-31");
    expect(previous[0].toISOString().slice(0, 10)).toBe("2026-07-04");
  });
});

describe("computeMomentumMetrics", () => {
  it("weights adherence 0.5, followThrough 0.3, surplusRate 0.2", () => {
    // One DAILY habit, fully logged every day of a 2-day window -> adherence 100.
    // One of two due tasks closed -> followThrough 50.
    // Income 100, outgoings 60 -> surplus 40%.
    const inputs: MomentumInputs = {
      habits: [{ id: "h1", schedule: { scheduleType: "DAILY", scheduleWeekdays: [], scheduleIntervalN: null, scheduleAnchorDate: null } }],
      checkIns: [
        { habitId: "h1", date: d("2026-08-01"), level: "FULL" },
        { habitId: "h1", date: d("2026-08-02"), level: "FULL" },
      ],
      tasks: [
        { dueDate: d("2026-08-01"), completedAt: d("2026-08-01") },
        { dueDate: d("2026-08-02"), completedAt: null },
      ],
      transactions: [
        { date: d("2026-08-01"), amount: 100, direction: "IN", receivableId: null, goalContributionId: null },
        { date: d("2026-08-01"), amount: 60, direction: "OUT", receivableId: null, goalContributionId: null },
      ],
    };
    const metrics = computeMomentumMetrics(inputs, d("2026-08-01"), d("2026-08-02"));
    expect(metrics.adherence).toBe(100);
    expect(metrics.followThrough).toBe(50);
    expect(metrics.surplusRate).toBe(40);
    // round(0.5*100 + 0.3*50 + 0.2*40) = round(50 + 15 + 8) = 73
    expect(metrics.score).toBe(73);
  });

  it("counts a MINIMUM check-in as half credit", () => {
    const inputs: MomentumInputs = {
      habits: [{ id: "h1", schedule: { scheduleType: "DAILY", scheduleWeekdays: [], scheduleIntervalN: null, scheduleAnchorDate: null } }],
      checkIns: [{ habitId: "h1", date: d("2026-08-01"), level: "MINIMUM" }],
      tasks: [],
      transactions: [],
    };
    const metrics = computeMomentumMetrics(inputs, d("2026-08-01"), d("2026-08-01"));
    expect(metrics.adherence).toBe(50);
  });

  it("returns 0 for a metric with no eligible rows in the window, rather than NaN", () => {
    const inputs: MomentumInputs = { habits: [], checkIns: [], tasks: [], transactions: [] };
    const metrics = computeMomentumMetrics(inputs, d("2026-08-01"), d("2026-08-02"));
    expect(metrics).toEqual({ score: 0, adherence: 0, followThrough: 0, surplusRate: 0 });
  });

  it("clamps surplusRate to 0 when outgoings exceed income", () => {
    const inputs: MomentumInputs = {
      habits: [],
      checkIns: [],
      tasks: [],
      transactions: [
        { date: d("2026-08-01"), amount: 50, direction: "IN", receivableId: null, goalContributionId: null },
        { date: d("2026-08-01"), amount: 200, direction: "OUT", receivableId: null, goalContributionId: null },
      ],
    };
    const metrics = computeMomentumMetrics(inputs, d("2026-08-01"), d("2026-08-01"));
    expect(metrics.surplusRate).toBe(0);
  });
});

describe("computeSurplusRate — receivable/goal-contribution exclusion", () => {
  it("excludes a receivable-flagged transaction from both income and outgoings", () => {
    const rate = computeSurplusRate(
      [
        { date: d("2026-08-01"), amount: 1000, direction: "IN", receivableId: null, goalContributionId: null },
        { date: d("2026-08-01"), amount: 500, direction: "OUT", receivableId: "r1", goalContributionId: null },
        { date: d("2026-08-01"), amount: 200, direction: "OUT", receivableId: null, goalContributionId: null },
      ],
      d("2026-08-01"),
      d("2026-08-01")
    );
    // Without the exclusion this would be (1000-700)/1000=30%; with it, (1000-200)/1000=80%.
    expect(rate).toBe(80);
  });

  it("excludes a goal-contribution-flagged transaction the same way", () => {
    const rate = computeSurplusRate(
      [
        { date: d("2026-08-01"), amount: 1000, direction: "IN", receivableId: null, goalContributionId: null },
        { date: d("2026-08-01"), amount: 300, direction: "OUT", receivableId: null, goalContributionId: "gc1" },
      ],
      d("2026-08-01"),
      d("2026-08-01")
    );
    expect(rate).toBe(100);
  });
});

describe("adherenceForHabit / computeAdherence — PER_WEEK", () => {
  it("uses the proportional weekly target as the scheduled count, not one-due-every-day", () => {
    // 4x/week target, over a 7-day window -> expectedCount = round(7/7*4) = 4, not 7.
    const habit = {
      id: "h1",
      schedule: {
        scheduleType: "PER_WEEK" as const,
        scheduleWeekdays: [],
        scheduleIntervalN: null,
        scheduleAnchorDate: null,
        scheduleTargetCount: 4,
      },
    };
    const checkIns = [
      { habitId: "h1", date: d("2026-08-03"), level: "FULL" as const },
      { habitId: "h1", date: d("2026-08-04"), level: "FULL" as const },
    ];
    const result = adherenceForHabit(habit, checkIns, d("2026-08-03"), d("2026-08-09"));
    expect(result.scheduled).toBe(4);
    expect(result.logged).toBe(2);
  });

  it("computeAdherence reports a fair percentage for a PER_WEEK habit, not deflated by non-due days", () => {
    const habits = [
      {
        id: "h1",
        schedule: {
          scheduleType: "PER_WEEK" as const,
          scheduleWeekdays: [],
          scheduleIntervalN: null,
          scheduleAnchorDate: null,
          scheduleTargetCount: 4,
        },
      },
    ];
    const checkIns = [
      { habitId: "h1", date: d("2026-08-03"), level: "FULL" as const },
      { habitId: "h1", date: d("2026-08-04"), level: "FULL" as const },
      { habitId: "h1", date: d("2026-08-05"), level: "FULL" as const },
      { habitId: "h1", date: d("2026-08-06"), level: "FULL" as const },
    ];
    // Hit the full weekly target (4/4) -> 100%, not 4/7 ≈ 57% as the old
    // every-day-is-due math would have reported.
    const pct = computeAdherence(habits, checkIns, d("2026-08-03"), d("2026-08-09"));
    expect(pct).toBe(100);
  });
});

describe("computeMomentumHistory", () => {
  it("returns 12 bars, the last matching a direct computeMomentumMetrics call for the same asOf window", () => {
    const inputs: MomentumInputs = {
      habits: [{ id: "h1", schedule: { scheduleType: "DAILY", scheduleWeekdays: [], scheduleIntervalN: null, scheduleAnchorDate: null } }],
      checkIns: [{ habitId: "h1", date: d("2026-08-28"), level: "FULL" }],
      tasks: [],
      transactions: [],
    };
    const bars = computeMomentumHistory(inputs, d("2026-08-28"));
    expect(bars).toHaveLength(12);
    const { current } = momentumWindows(d("2026-08-28"));
    expect(bars[11]).toBe(computeMomentumMetrics(inputs, current[0], current[1]).score);
  });
});

describe("momentumWrittenRead", () => {
  it("names the metric with the largest positive delta as carrying the period", () => {
    const current = { score: 70, adherence: 80, followThrough: 60, surplusRate: 50 };
    const previous = { score: 50, adherence: 50, followThrough: 58, surplusRate: 49 };
    const text = momentumWrittenRead(current, previous);
    expect(text).toContain("Habits is carrying this period");
    expect(text).toContain("adherence up 30 points");
  });

  it("names the lowest current metric as the weak link", () => {
    const current = { score: 60, adherence: 90, followThrough: 70, surplusRate: 20 };
    const previous = { score: 55, adherence: 85, followThrough: 68, surplusRate: 19 };
    const text = momentumWrittenRead(current, previous);
    expect(text).toContain("weak link is surplus: 20%");
  });
});

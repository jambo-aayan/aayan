import { describe, expect, it } from "vitest";
import {
  computeMomentumMetrics,
  computeMomentumHistory,
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
        { date: d("2026-08-01"), amount: 100, direction: "IN" },
        { date: d("2026-08-01"), amount: 60, direction: "OUT" },
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
        { date: d("2026-08-01"), amount: 50, direction: "IN" },
        { date: d("2026-08-01"), amount: 200, direction: "OUT" },
      ],
    };
    const metrics = computeMomentumMetrics(inputs, d("2026-08-01"), d("2026-08-01"));
    expect(metrics.surplusRate).toBe(0);
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

import { describe, expect, it } from "vitest";
import {
  computeHabitAdherenceKpi,
  computeTaskFollowThroughKpi,
  computeGoalVelocityKpi,
  computeSurplusRateKpi,
  buildHabitAdherenceDrillDown,
  buildSurplusRateDrillDown,
  type HabitAdherenceFixture,
  type TaskWithListFixture,
  type GoalActivityFixture,
  type CategorizedTransactionFixture,
} from "./kpis";

function d(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

describe("computeHabitAdherenceKpi", () => {
  const habits: HabitAdherenceFixture[] = [
    { id: "h1", name: "Stretch", schedule: { scheduleType: "DAILY", scheduleWeekdays: [], scheduleIntervalN: null, scheduleAnchorDate: null } },
    { id: "h2", name: "Read", schedule: { scheduleType: "DAILY", scheduleWeekdays: [], scheduleIntervalN: null, scheduleAnchorDate: null } },
  ];

  it("computes overall value and delta vs the previous period", () => {
    const checkIns = [
      { habitId: "h1", date: d("2026-08-01"), level: "FULL" as const },
      { habitId: "h2", date: d("2026-08-01"), level: "FULL" as const },
    ];
    const result = computeHabitAdherenceKpi(habits, checkIns, d("2026-08-01"), d("2026-08-01"), d("2026-07-31"), d("2026-07-31"));
    expect(result.value).toBe(100);
    expect(result.delta).toBe(100); // previous period had zero logged occurrences
  });

  it("names the weakest habit as the diagnosis's contributor when it's below 80%", () => {
    const checkIns = [{ habitId: "h1", date: d("2026-08-01"), level: "FULL" as const }]; // h2 unlogged
    const result = computeHabitAdherenceKpi(habits, checkIns, d("2026-08-01"), d("2026-08-01"), d("2026-07-31"), d("2026-07-31"));
    expect(result.diagnosis).toContain("Read is the only miss.");
  });

  it("returns a sparkline with 10 bars", () => {
    const result = computeHabitAdherenceKpi(habits, [], d("2026-08-01"), d("2026-08-10"), d("2026-07-22"), d("2026-07-31"));
    expect(result.sparkline).toHaveLength(10);
  });
});

describe("computeTaskFollowThroughKpi", () => {
  it("names the list carrying the most open tasks", () => {
    const tasks: TaskWithListFixture[] = [
      { dueDate: d("2026-08-01"), completedAt: null, listName: "Work" },
      { dueDate: d("2026-08-01"), completedAt: null, listName: "Work" },
      { dueDate: d("2026-08-01"), completedAt: d("2026-08-01"), listName: "Personal" },
    ];
    const result = computeTaskFollowThroughKpi(tasks, d("2026-08-01"), d("2026-08-01"), d("2026-07-31"), d("2026-07-31"));
    expect(result.value).toBeCloseTo(33.3, 1);
    expect(result.diagnosis).toContain("Work is carrying the most open tasks (2)");
  });

  it("falls back to Inbox for a null list name", () => {
    const tasks: TaskWithListFixture[] = [{ dueDate: d("2026-08-01"), completedAt: null, listName: null }];
    const result = computeTaskFollowThroughKpi(tasks, d("2026-08-01"), d("2026-08-01"), d("2026-07-31"), d("2026-07-31"));
    expect(result.diagnosis).toContain("Inbox is carrying");
  });
});

describe("computeGoalVelocityKpi", () => {
  it("computes the share of active goals with activity in the window", () => {
    const goals: GoalActivityFixture[] = [
      { id: "g1", name: "Run a 10k", lastActivityAt: d("2026-08-05") },
      { id: "g2", name: "Save for house", lastActivityAt: null },
    ];
    const result = computeGoalVelocityKpi(goals, d("2026-08-01"), d("2026-08-10"), d("2026-07-22"), d("2026-07-31"));
    expect(result.value).toBe(50);
    expect(result.diagnosis).toContain('"Save for house" hasn\'t moved.');
  });

  it("reports no active goals distinctly from zero velocity", () => {
    const result = computeGoalVelocityKpi([], d("2026-08-01"), d("2026-08-10"), d("2026-07-22"), d("2026-07-31"));
    expect(result.value).toBe(0);
    expect(result.diagnosis).toBe("No active goals yet.");
  });
});

describe("computeSurplusRateKpi", () => {
  it("names the biggest outgoing category as the drain", () => {
    const transactions: CategorizedTransactionFixture[] = [
      { date: d("2026-08-01"), amount: 3000, direction: "IN", category: "Salary", receivableId: null, goalContributionId: null },
      { date: d("2026-08-01"), amount: 1200, direction: "OUT", category: "Rent", receivableId: null, goalContributionId: null },
      { date: d("2026-08-02"), amount: 400, direction: "OUT", category: "Groceries", receivableId: null, goalContributionId: null },
    ];
    const result = computeSurplusRateKpi(transactions, d("2026-08-01"), d("2026-08-02"), d("2026-07-30"), d("2026-07-31"));
    expect(result.value).toBeCloseTo(46.7, 1);
    expect(result.diagnosis).toContain("Rent is the biggest drain.");
  });
});

describe("buildHabitAdherenceDrillDown", () => {
  const habits: HabitAdherenceFixture[] = [
    { id: "h1", name: "Stretch", schedule: { scheduleType: "DAILY", scheduleWeekdays: [], scheduleIntervalN: null, scheduleAnchorDate: null } },
  ];

  it("builds a 14-bar series and summary stats agreeing with the KPI's own value", () => {
    const checkIns = [{ habitId: "h1", date: d("2026-08-01"), level: "FULL" as const }];
    const drillDown = buildHabitAdherenceDrillDown(habits, checkIns, d("2026-08-01"), d("2026-08-01"), d("2026-07-31"), d("2026-07-31"), "Read.");
    expect(drillDown.kindEyebrow).toBe("KPI breakdown");
    expect(drillDown.series).toHaveLength(14);
    expect(drillDown.summaryStats[0]).toEqual({ label: "This period", value: "100%" });
    expect(drillDown.writtenRead).toBe("Read.");
  });

  it("orders entries most-recent-first and tones them by value", () => {
    const checkIns = [{ habitId: "h1", date: d("2026-08-02"), level: "FULL" as const }]; // 08-01 unlogged, 08-02 logged
    const drillDown = buildHabitAdherenceDrillDown(habits, checkIns, d("2026-08-01"), d("2026-08-02"), d("2026-07-30"), d("2026-07-31"), "Read.");
    expect(drillDown.entries[0].date).toBe("2026-08-02");
    expect(drillDown.entries[0].tone).toBe("positive");
    expect(drillDown.entries[1].date).toBe("2026-08-01");
    expect(drillDown.entries[1].tone).toBe("danger");
  });
});

describe("buildSurplusRateDrillDown", () => {
  it("caps entries at 20 for a long range without breaking the series/summary", () => {
    const transactions: CategorizedTransactionFixture[] = [
      { date: d("2026-06-01"), amount: 1000, direction: "IN", category: "Salary", receivableId: null, goalContributionId: null },
    ];
    const drillDown = buildSurplusRateDrillDown(transactions, d("2026-06-01"), d("2026-08-30"), d("2026-03-04"), d("2026-05-31"), "Read.");
    expect(drillDown.entries.length).toBeLessThanOrEqual(20);
    expect(drillDown.series).toHaveLength(14);
  });
});

import { describe, expect, it } from "vitest";
import { computeConsistencyGrid, type ConsistencyHabitFixture } from "./consistency";

function d(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

const DAILY = { scheduleType: "DAILY" as const, scheduleWeekdays: [], scheduleIntervalN: null, scheduleAnchorDate: null };

describe("computeConsistencyGrid", () => {
  it("marks cells full/partial/none per check-in level", () => {
    const habits: ConsistencyHabitFixture[] = [
      {
        id: "h1",
        name: "Stretch",
        schedule: DAILY,
        checkIns: [
          { date: d("2026-08-01"), level: "FULL" },
          { date: d("2026-08-02"), level: "MINIMUM" },
        ],
      },
    ];
    const grid = computeConsistencyGrid(habits, d("2026-08-01"), d("2026-08-03"));
    expect(grid.rows[0].cells).toEqual(["full", "partial", "none"]);
  });

  it("computes pct as logged (full=1, partial=0.5) over scheduled days only", () => {
    // Weekdays-only habit over Fri(21)/Sat(22)/Sun(23)/Mon(24) 2026-08 — only Fri and Mon are scheduled.
    const habits: ConsistencyHabitFixture[] = [
      {
        id: "h1",
        name: "Gym",
        schedule: { scheduleType: "WEEKDAYS", scheduleWeekdays: [], scheduleIntervalN: null, scheduleAnchorDate: null },
        checkIns: [{ date: d("2026-08-21"), level: "FULL" }], // Friday logged, Monday missed
      },
    ];
    const grid = computeConsistencyGrid(habits, d("2026-08-21"), d("2026-08-24"));
    expect(grid.rows[0].pct).toBe(50); // 1 of 2 scheduled days (Fri, Mon)
  });

  it("excludes unscheduled days from the percentage denominator", () => {
    // 2026-08-03 is a Monday; a Monday-only habit is scheduled on exactly
    // one of the three days in this window, not diluted by the other two.
    const habits: ConsistencyHabitFixture[] = [
      {
        id: "h1",
        name: "Monday review",
        schedule: { scheduleType: "SELECTED_WEEKDAYS", scheduleWeekdays: [1], scheduleIntervalN: null, scheduleAnchorDate: null },
        checkIns: [{ date: d("2026-08-03"), level: "FULL" }],
      },
    ];
    const grid = computeConsistencyGrid(habits, d("2026-08-02"), d("2026-08-04"));
    expect(grid.rows[0].pct).toBe(100);
  });

  it("finds the longest consecutive-day streak within the window, naming the habit", () => {
    const habits: ConsistencyHabitFixture[] = [
      {
        id: "h1",
        name: "Read",
        schedule: DAILY,
        checkIns: [
          { date: d("2026-08-01"), level: "FULL" },
          { date: d("2026-08-02"), level: "FULL" },
          { date: d("2026-08-03"), level: "FULL" },
        ],
      },
      { id: "h2", name: "Meditate", schedule: DAILY, checkIns: [{ date: d("2026-08-05"), level: "FULL" }] },
    ];
    const grid = computeConsistencyGrid(habits, d("2026-08-01"), d("2026-08-07"));
    expect(grid.longestStreak).toEqual({ habitName: "Read", days: 3 });
  });

  it("counts habits above 60%", () => {
    const habits: ConsistencyHabitFixture[] = [
      { id: "h1", name: "A", schedule: DAILY, checkIns: [{ date: d("2026-08-01"), level: "FULL" }, { date: d("2026-08-02"), level: "FULL" }] }, // 100%
      { id: "h2", name: "B", schedule: DAILY, checkIns: [] }, // 0%
    ];
    const grid = computeConsistencyGrid(habits, d("2026-08-01"), d("2026-08-02"));
    expect(grid.habitsAbove60).toBe(1);
  });

  it("identifies the weakest weekday across all habits", () => {
    // Two daily habits over Fri/Sat: Friday fully logged for both, Saturday unlogged for both.
    const habits: ConsistencyHabitFixture[] = [
      { id: "h1", name: "A", schedule: DAILY, checkIns: [{ date: d("2026-08-21"), level: "FULL" }] },
      { id: "h2", name: "B", schedule: DAILY, checkIns: [{ date: d("2026-08-21"), level: "FULL" }] },
    ];
    const grid = computeConsistencyGrid(habits, d("2026-08-21"), d("2026-08-22"));
    expect(grid.weakestWeekday).toEqual({ weekday: 6, label: "Saturday", pct: 0 }); // 2026-08-22 is a Saturday
  });

  it("returns null footer stats when there are no habits", () => {
    const grid = computeConsistencyGrid([], d("2026-08-01"), d("2026-08-02"));
    expect(grid.longestStreak).toBeNull();
    expect(grid.weakestWeekday).toBeNull();
    expect(grid.habitsAbove60).toBe(0);
  });
});

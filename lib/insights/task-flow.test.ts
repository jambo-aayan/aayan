import { describe, expect, it } from "vitest";
import {
  computeTaskFlowWeeks,
  computeCarryOverRate,
  computeMedianOpenTaskAge,
  computeOnTimeCloseRate,
  type TaskFlowFixture,
} from "./task-flow";

function d(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

describe("computeTaskFlowWeeks", () => {
  it("counts created and closed independently per week", () => {
    const tasks: TaskFlowFixture[] = [
      { createdAt: d("2026-08-03"), dueDate: null, completedAt: null }, // created wk1, still open
      { createdAt: d("2026-07-27"), dueDate: null, completedAt: d("2026-08-04") }, // created wk before, closed wk1
    ];
    const weeks = computeTaskFlowWeeks(tasks, [d("2026-08-03")]);
    expect(weeks).toEqual([{ weekStart: "2026-08-03", created: 1, closed: 1 }]);
  });

  it("returns one bar per week start, in order", () => {
    const weeks = computeTaskFlowWeeks([], [d("2026-08-03"), d("2026-08-10")]);
    expect(weeks.map((w) => w.weekStart)).toEqual(["2026-08-03", "2026-08-10"]);
  });
});

describe("computeCarryOverRate", () => {
  it("is the % of tasks due in the window that are still open as of asOf", () => {
    const tasks: TaskFlowFixture[] = [
      { createdAt: d("2026-08-01"), dueDate: d("2026-08-03"), completedAt: d("2026-08-03") }, // closed
      { createdAt: d("2026-08-01"), dueDate: d("2026-08-04"), completedAt: null }, // still open
    ];
    const rate = computeCarryOverRate(tasks, d("2026-08-01"), d("2026-08-10"), d("2026-08-15"));
    expect(rate).toBe(50);
  });

  it("excludes tasks with no due date from the ratio", () => {
    const tasks: TaskFlowFixture[] = [{ createdAt: d("2026-08-01"), dueDate: null, completedAt: null }];
    expect(computeCarryOverRate(tasks, d("2026-08-01"), d("2026-08-10"), d("2026-08-15"))).toBe(0);
  });

  it("counts a task closed after asOf as still open at that point in time", () => {
    const tasks: TaskFlowFixture[] = [{ createdAt: d("2026-08-01"), dueDate: d("2026-08-03"), completedAt: d("2026-08-20") }];
    expect(computeCarryOverRate(tasks, d("2026-08-01"), d("2026-08-10"), d("2026-08-15"))).toBe(100);
  });
});

describe("computeMedianOpenTaskAge", () => {
  it("computes the median age in days", () => {
    const openTasks = [{ createdAt: d("2026-08-01") }, { createdAt: d("2026-08-11") }, { createdAt: d("2026-08-16") }];
    // ages as of 08-21: 20, 10, 5 -> sorted 5,10,20 -> median 10
    expect(computeMedianOpenTaskAge(openTasks, d("2026-08-21"))).toBe(10);
  });

  it("averages the two middle ages for an even count", () => {
    const openTasks = [{ createdAt: d("2026-08-11") }, { createdAt: d("2026-08-01") }];
    // ages: 10, 20 -> median 15
    expect(computeMedianOpenTaskAge(openTasks, d("2026-08-21"))).toBe(15);
  });

  it("returns null when there are no open tasks", () => {
    expect(computeMedianOpenTaskAge([], d("2026-08-21"))).toBeNull();
  });
});

describe("computeOnTimeCloseRate", () => {
  it("computes % of closed-with-due-date tasks closed on or before due", () => {
    const tasks: TaskFlowFixture[] = [
      { createdAt: d("2026-08-01"), dueDate: d("2026-08-05"), completedAt: d("2026-08-04") }, // on time
      { createdAt: d("2026-08-01"), dueDate: d("2026-08-05"), completedAt: d("2026-08-05") }, // on time (exactly due)
      { createdAt: d("2026-08-01"), dueDate: d("2026-08-05"), completedAt: d("2026-08-06") }, // late
    ];
    expect(computeOnTimeCloseRate(tasks)).toBe(67);
  });

  it("excludes still-open and no-due-date tasks from the ratio", () => {
    const tasks: TaskFlowFixture[] = [
      { createdAt: d("2026-08-01"), dueDate: d("2026-08-05"), completedAt: null },
      { createdAt: d("2026-08-01"), dueDate: null, completedAt: d("2026-08-05") },
    ];
    expect(computeOnTimeCloseRate(tasks)).toBe(0);
  });
});

import { describe, expect, it } from "vitest";
import { habitsNotCheckedIn, todaysGoals } from "./today";

describe("habitsNotCheckedIn", () => {
  it("keeps only habits with no check-in today", () => {
    const habits = [
      { id: "1", name: "Stretch", areaName: "Ankylosing Spondylitis", todayLevel: null },
      { id: "2", name: "Walk", areaName: "Sleep", todayLevel: "FULL" as const },
      { id: "3", name: "Read", areaName: "Sleep", todayLevel: "MINIMUM" as const },
    ];
    expect(habitsNotCheckedIn(habits).map((h) => h.id)).toEqual(["1"]);
  });

  it("returns an empty list when every habit is already checked in", () => {
    const habits = [{ id: "1", name: "Stretch", areaName: "AS", todayLevel: "FULL" as const }];
    expect(habitsNotCheckedIn(habits)).toEqual([]);
  });
});

describe("todaysGoals", () => {
  const today = new Date("2026-08-15T00:00:00.000Z");

  it("includes a myday-flagged goal regardless of due date", () => {
    const goals = [
      { id: "g1", name: "Meal plan", areaName: "Diet", status: "IN_PROGRESS" as const, dueDate: null, myday: true },
    ];
    expect(todaysGoals(goals, today).map((g) => g.id)).toEqual(["g1"]);
  });

  it("includes a non-myday goal due exactly today", () => {
    const goals = [
      {
        id: "g2",
        name: "Pay rent",
        areaName: "Finances",
        status: "NOT_STARTED" as const,
        dueDate: new Date("2026-08-15T00:00:00.000Z"),
        myday: false,
      },
    ];
    expect(todaysGoals(goals, today).map((g) => g.id)).toEqual(["g2"]);
  });

  it("excludes a non-myday goal due on a different day", () => {
    const goals = [
      {
        id: "g3",
        name: "Future goal",
        areaName: "Diet",
        status: "NOT_STARTED" as const,
        dueDate: new Date("2026-08-20T00:00:00.000Z"),
        myday: false,
      },
    ];
    expect(todaysGoals(goals, today)).toEqual([]);
  });

  it("dedupes a goal that is both myday-flagged and due today", () => {
    const goals = [
      {
        id: "g4",
        name: "Both",
        areaName: "Diet",
        status: "NOT_STARTED" as const,
        dueDate: new Date("2026-08-15T00:00:00.000Z"),
        myday: true,
      },
    ];
    expect(todaysGoals(goals, today).length).toBe(1);
  });

  it("returns an empty list for goals with no due date and not flagged for My Day", () => {
    const goals = [
      { id: "g5", name: "Backlog", areaName: "Diet", status: "NOT_STARTED" as const, dueDate: null, myday: false },
    ];
    expect(todaysGoals(goals, today)).toEqual([]);
  });

  it("excludes a non-myday goal that's overdue rather than due today", () => {
    const goals = [
      {
        id: "g6",
        name: "Overdue",
        areaName: "Diet",
        status: "NOT_STARTED" as const,
        dueDate: new Date("2026-08-01T00:00:00.000Z"),
        myday: false,
      },
    ];
    expect(todaysGoals(goals, today)).toEqual([]);
  });

  it("keeps a myday-flagged goal even once it's DONE — nothing here clears myday on completion", () => {
    const goals = [
      { id: "g7", name: "Finished", areaName: "Diet", status: "DONE" as const, dueDate: null, myday: true },
    ];
    expect(todaysGoals(goals, today).map((g) => g.id)).toEqual(["g7"]);
  });
});

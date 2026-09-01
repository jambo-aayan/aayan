import { describe, expect, it } from "vitest";
import {
  goalBuiltInValues,
  habitBuiltInValues,
  isBuiltInColumnId,
  systemBuiltInValues,
  taskBuiltInValues,
} from "./table-binding";

describe("goalBuiltInValues", () => {
  it("computes progress % from linked tasks' completion", () => {
    const values = goalBuiltInValues({
      name: "Run a marathon",
      status: "ACTIVE",
      tasks: [{ completedAt: new Date() }, { completedAt: null }, { completedAt: new Date() }],
    });
    expect(values).toEqual({ "goals:name": "Run a marathon", "goals:status": "ACTIVE", "goals:progress": 67 });
  });

  it("returns 0 progress with no linked tasks, not NaN", () => {
    const values = goalBuiltInValues({ name: "No tasks yet", status: "ACTIVE", tasks: [] });
    expect(values["goals:progress"]).toBe(0);
  });
});

describe("habitBuiltInValues", () => {
  it("reuses streakForHabit for the current streak", () => {
    const values = habitBuiltInValues({
      name: "Meditate",
      status: "ACTIVE",
      scheduleType: "DAILY",
      scheduleTargetCount: null,
      checkInDates: [new Date("2026-01-01"), new Date("2026-01-02")],
    });
    expect(values).toEqual({ "habits:name": "Meditate", "habits:status": "ACTIVE", "habits:streak": 2 });
  });
});

describe("taskBuiltInValues", () => {
  it("maps title/list/due date/completion", () => {
    const values = taskBuiltInValues({
      title: "Book flights",
      listName: "Travel",
      dueDate: new Date("2026-03-01"),
      completedAt: null,
    });
    expect(values).toEqual({
      "tasks:title": "Book flights",
      "tasks:list": "Travel",
      "tasks:dueDate": "2026-03-01",
      "tasks:completed": false,
    });
  });

  it("handles a null list and null due date", () => {
    const values = taskBuiltInValues({ title: "Untitled", listName: null, dueDate: null, completedAt: new Date() });
    expect(values["tasks:list"]).toBeNull();
    expect(values["tasks:dueDate"]).toBeNull();
    expect(values["tasks:completed"]).toBe(true);
  });
});

describe("systemBuiltInValues", () => {
  it("maps name/type/state", () => {
    expect(systemBuiltInValues({ name: "Morning routine", type: "HABIT_LOOP", state: "ACTIVE" })).toEqual({
      "systems:name": "Morning routine",
      "systems:type": "HABIT_LOOP",
      "systems:state": "ACTIVE",
    });
  });
});

describe("isBuiltInColumnId", () => {
  it("recognizes a built-in column id by its colon", () => {
    expect(isBuiltInColumnId("goals:name")).toBe(true);
    expect(isBuiltInColumnId("habits:streak")).toBe(true);
  });

  it("returns false for a real TableColumn's cuid", () => {
    expect(isBuiltInColumnId("cljk3f9xy0000qzrmn831i7d")).toBe(false);
  });
});

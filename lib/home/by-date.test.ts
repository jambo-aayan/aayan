import { describe, expect, it } from "vitest";
import { groupActionsByDueDate } from "./by-date";

describe("groupActionsByDueDate", () => {
  it("groups goals by due date, sorted earliest first", () => {
    const goals = [
      { id: "1", name: "Later", dueDate: new Date("2026-09-01T00:00:00.000Z") },
      { id: "2", name: "Sooner", dueDate: new Date("2026-08-20T00:00:00.000Z") },
    ];
    const result = groupActionsByDueDate(goals);
    expect(result.map((g) => g.date.toISOString())).toEqual([
      "2026-08-20T00:00:00.000Z",
      "2026-09-01T00:00:00.000Z",
    ]);
  });

  it("groups multiple goals sharing the same due date into one entry", () => {
    const goals = [
      { id: "1", name: "A", dueDate: new Date("2026-08-20T00:00:00.000Z") },
      { id: "2", name: "B", dueDate: new Date("2026-08-20T00:00:00.000Z") },
    ];
    const result = groupActionsByDueDate(goals);
    expect(result).toHaveLength(1);
    expect(result[0].goals.map((g) => g.id)).toEqual(["1", "2"]);
  });

  it("excludes goals with no due date", () => {
    const goals = [
      { id: "1", name: "Has date", dueDate: new Date("2026-08-20T00:00:00.000Z") },
      { id: "2", name: "No date", dueDate: null },
    ];
    const result = groupActionsByDueDate(goals);
    expect(result).toHaveLength(1);
    expect(result[0].goals.map((g) => g.id)).toEqual(["1"]);
  });

  it("returns an empty array when nothing has a due date", () => {
    expect(groupActionsByDueDate([{ id: "1", name: "No date", dueDate: null }])).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import { groupTasksByDate } from "./date-groups";

const TODAY = new Date("2026-08-17T00:00:00.000Z"); // Monday

function task(id: string, iso: string | null) {
  return { id, dueDate: iso ? new Date(`${iso}T00:00:00.000Z`) : null };
}

describe("groupTasksByDate", () => {
  it("buckets tasks into overdue/today/tomorrow/this week/later/no due date", () => {
    const tasks = [
      task("overdue", "2026-08-15"),
      task("today", "2026-08-17"),
      task("tomorrow", "2026-08-18"),
      task("this-week", "2026-08-20"),
      task("later", "2026-09-01"),
      task("no-date", null),
    ];

    const groups = groupTasksByDate(tasks, TODAY);

    expect(groups.overdue.map((t) => t.id)).toEqual(["overdue"]);
    expect(groups.today.map((t) => t.id)).toEqual(["today"]);
    expect(groups.tomorrow.map((t) => t.id)).toEqual(["tomorrow"]);
    expect(groups.thisWeek.map((t) => t.id)).toEqual(["this-week"]);
    expect(groups.later.map((t) => t.id)).toEqual(["later"]);
    expect(groups.noDueDate.map((t) => t.id)).toEqual(["no-date"]);
  });

  it("treats the day exactly 7 days out as later, not this week", () => {
    const tasks = [task("boundary", "2026-08-24")];
    const groups = groupTasksByDate(tasks, TODAY);
    expect(groups.later.map((t) => t.id)).toEqual(["boundary"]);
    expect(groups.thisWeek).toEqual([]);
  });
});

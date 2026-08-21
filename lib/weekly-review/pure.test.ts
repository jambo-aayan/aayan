import { describe, expect, it } from "vitest";
import { nextWeekDueDate, stalenessBucket, sortByStaleness, topThree, reconcileRankOrder } from "./pure";

function d(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

describe("nextWeekDueDate", () => {
  it("adds 7 days to today, not to any existing due date", () => {
    expect(nextWeekDueDate(d("2026-08-21")).toISOString().slice(0, 10)).toBe("2026-08-28");
  });
});

describe("stalenessBucket", () => {
  const today = d("2026-08-21");

  it("buckets overdue, today, tomorrow, this week, and no date correctly", () => {
    expect(stalenessBucket(d("2026-08-20"), today)).toBe("Overdue");
    expect(stalenessBucket(d("2026-08-21"), today)).toBe("Today");
    expect(stalenessBucket(d("2026-08-22"), today)).toBe("Tomorrow");
    expect(stalenessBucket(d("2026-08-25"), today)).toBe("This week");
    expect(stalenessBucket(d("2026-08-28"), today)).toBe("This week");
    expect(stalenessBucket(d("2026-08-29"), today)).toBe("No date"); // 8 days out falls past "this week"
    expect(stalenessBucket(null, today)).toBe("No date");
  });
});

describe("sortByStaleness", () => {
  it("orders Overdue -> Today -> Tomorrow -> This week -> No date", () => {
    const today = d("2026-08-21");
    const tasks = [
      { id: "nodate", dueDate: null },
      { id: "week", dueDate: d("2026-08-25") },
      { id: "overdue", dueDate: d("2026-08-15") },
      { id: "today", dueDate: today },
      { id: "tomorrow", dueDate: d("2026-08-22") },
    ];
    const sorted = sortByStaleness(tasks, today);
    expect(sorted.map((t) => t.id)).toEqual(["overdue", "today", "tomorrow", "week", "nodate"]);
  });

  it("breaks ties within a bucket by earliest due date first", () => {
    const today = d("2026-08-21");
    const tasks = [
      { id: "less-overdue", dueDate: d("2026-08-19") },
      { id: "more-overdue", dueDate: d("2026-08-10") },
    ];
    expect(sortByStaleness(tasks, today).map((t) => t.id)).toEqual(["more-overdue", "less-overdue"]);
  });
});

describe("topThree", () => {
  it("takes the first 3 items", () => {
    expect(topThree(["a", "b", "c", "d", "e"])).toEqual(["a", "b", "c"]);
  });

  it("returns fewer than 3 when the list is shorter", () => {
    expect(topThree(["a"])).toEqual(["a"]);
  });
});

describe("reconcileRankOrder", () => {
  it("keeps saved ordering for ids still present", () => {
    expect(reconcileRankOrder(["b", "a"], ["a", "b"])).toEqual(["b", "a"]);
  });

  it("appends new candidates at the end", () => {
    expect(reconcileRankOrder(["a"], ["a", "b"])).toEqual(["a", "b"]);
  });

  it("drops ids no longer in the candidate set", () => {
    expect(reconcileRankOrder(["a", "b"], ["b"])).toEqual(["b"]);
  });

  it("returns the candidate list unchanged when nothing was saved yet", () => {
    expect(reconcileRankOrder([], ["a", "b", "c"])).toEqual(["a", "b", "c"]);
  });
});

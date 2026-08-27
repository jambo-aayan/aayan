import { describe, expect, it } from "vitest";
import { canFlagAsReceivable, resolveAccountValueAt, sortGoalsByPriority } from "./logic";

describe("resolveAccountValueAt", () => {
  it("returns null when there are no snapshots on or before the given date", () => {
    const snapshots = [{ date: new Date("2026-09-01"), balance: 100 }];
    expect(resolveAccountValueAt(snapshots, new Date("2026-08-31"))).toBeNull();
  });

  it("returns the most recent snapshot on or before the given date, carried forward", () => {
    const snapshots = [
      { date: new Date("2026-06-15"), balance: 1000 },
      { date: new Date("2026-07-20"), balance: 1200 },
    ];
    // No August snapshot at all — carries July's value forward.
    expect(resolveAccountValueAt(snapshots, new Date("2026-08-31"))).toBe(1200);
  });

  it("ignores snapshots after the given date", () => {
    const snapshots = [
      { date: new Date("2026-07-20"), balance: 1200 },
      { date: new Date("2026-09-05"), balance: 1500 },
    ];
    expect(resolveAccountValueAt(snapshots, new Date("2026-08-31"))).toBe(1200);
  });

  it("uses the exact-date snapshot when one falls on the boundary", () => {
    const snapshots = [
      { date: new Date("2026-07-20"), balance: 1200 },
      { date: new Date("2026-08-31"), balance: 1300 },
    ];
    expect(resolveAccountValueAt(snapshots, new Date("2026-08-31"))).toBe(1300);
  });

  it("picks the latest among multiple eligible snapshots, not just the last in the array", () => {
    const snapshots = [
      { date: new Date("2026-08-10"), balance: 900 },
      { date: new Date("2026-06-01"), balance: 100 },
      { date: new Date("2026-07-15"), balance: 500 },
    ];
    expect(resolveAccountValueAt(snapshots, new Date("2026-08-31"))).toBe(900);
  });
});

describe("sortGoalsByPriority", () => {
  it("sorts ascending by priority rank", () => {
    const goals = [
      { id: "a", priority: 2 },
      { id: "b", priority: 0 },
      { id: "c", priority: 1 },
    ];
    expect(sortGoalsByPriority(goals).map((g) => g.id)).toEqual(["b", "c", "a"]);
  });

  it("keeps input order stable among equal priorities", () => {
    const goals = [
      { id: "a", priority: 0 },
      { id: "b", priority: 0 },
    ];
    expect(sortGoalsByPriority(goals).map((g) => g.id)).toEqual(["a", "b"]);
  });

  it("does not mutate the input array", () => {
    const goals = [
      { id: "a", priority: 2 },
      { id: "b", priority: 0 },
    ];
    sortGoalsByPriority(goals);
    expect(goals.map((g) => g.id)).toEqual(["a", "b"]);
  });
});

describe("canFlagAsReceivable", () => {
  it("allows flagging a transaction with no existing reclassification", () => {
    expect(canFlagAsReceivable({ receivableId: null })).toBe(true);
  });

  it("refuses a transaction already linked to a receivable", () => {
    expect(canFlagAsReceivable({ receivableId: "rec1" })).toBe(false);
  });
});

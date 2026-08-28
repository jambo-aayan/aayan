import { describe, expect, it } from "vitest";
import {
  canReclassifyTransaction,
  isHeldForReview,
  netTransactionAmount,
  resolveAccountValueAt,
  resolveStatementBalance,
  sortGoalsByPriority,
  validateStatementUpload,
} from "./logic";

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

describe("canReclassifyTransaction", () => {
  it("allows reclassifying a transaction with no existing link", () => {
    expect(canReclassifyTransaction({ receivableId: null, goalContributionId: null })).toBe(true);
  });

  it("refuses a transaction already linked to a receivable", () => {
    expect(canReclassifyTransaction({ receivableId: "rec1", goalContributionId: null })).toBe(false);
  });

  it("refuses a transaction already linked to a goal contribution", () => {
    expect(canReclassifyTransaction({ receivableId: null, goalContributionId: "gc1" })).toBe(false);
  });
});

describe("isHeldForReview", () => {
  it("holds a transaction below the confidence threshold", () => {
    expect(isHeldForReview(0.4)).toBe(true);
  });

  it("does not hold a transaction at or above the confidence threshold", () => {
    expect(isHeldForReview(0.7)).toBe(false);
    expect(isHeldForReview(0.95)).toBe(false);
  });

  it("never holds a manually entered transaction (null confidence)", () => {
    expect(isHeldForReview(null)).toBe(false);
  });
});

describe("validateStatementUpload", () => {
  it("accepts a PDF within the size limit", () => {
    expect(validateStatementUpload("application/pdf", 1024)).toEqual({ ok: true });
  });

  it("accepts a CSV within the size limit", () => {
    expect(validateStatementUpload("text/csv", 1024)).toEqual({ ok: true });
  });

  it("rejects an unsupported file type", () => {
    const result = validateStatementUpload("image/png", 1024);
    expect(result.ok).toBe(false);
  });

  it("rejects a file over the size cap", () => {
    const result = validateStatementUpload("application/pdf", 11 * 1024 * 1024);
    expect(result.ok).toBe(false);
  });
});

describe("netTransactionAmount", () => {
  it("is zero for no transactions", () => {
    expect(netTransactionAmount([])).toBe(0);
  });

  it("sums IN as positive and OUT as negative", () => {
    const result = netTransactionAmount([
      { amount: 100, direction: "IN" },
      { amount: 40, direction: "OUT" },
      { amount: 10, direction: "OUT" },
    ]);
    expect(result).toBe(50);
  });
});

describe("resolveStatementBalance", () => {
  it("uses the statement's own closing balance when stated, ignoring the computed delta", () => {
    const result = resolveStatementBalance(0, [{ amount: 500, direction: "OUT" }], 9015.44);
    expect(result).toBe(9015.44);
  });

  it("recovers from a wrong prior running balance, since it doesn't build on previousBalance at all", () => {
    // previousBalance is 0 (e.g. a fresh account with no baseline entered),
    // but the statement's own stated closing balance is the real figure —
    // this is the exact bug scenario: a running total starting from 0
    // never learns the account's actual opening balance.
    const result = resolveStatementBalance(0, [], 11040.59);
    expect(result).toBe(11040.59);
  });

  it("falls back to the computed running total when the statement states no balance", () => {
    const result = resolveStatementBalance(100, [{ amount: 40, direction: "OUT" }, { amount: 10, direction: "IN" }], null);
    expect(result).toBe(70);
  });
});

import { describe, expect, it } from "vitest";
import { partitionNewTransactions } from "./statement-dedup";

const ACCOUNT_ID = "acc-1";

describe("partitionNewTransactions", () => {
  it("inserts everything when there's no overlap with existing transactions", () => {
    const parsed = [
      { date: "2026-08-01", amount: 10, direction: "OUT" as const },
      { date: "2026-08-02", amount: 20, direction: "IN" as const },
    ];
    const result = partitionNewTransactions(ACCOUNT_ID, parsed, []);
    expect(result.toInsert).toEqual(parsed);
    expect(result.skipped).toEqual([]);
  });

  it("skips everything already imported (full overlap)", () => {
    const parsed = [
      { date: "2026-08-01", amount: 10, direction: "OUT" as const },
      { date: "2026-08-02", amount: 20, direction: "IN" as const },
    ];
    const existing = [
      { accountId: ACCOUNT_ID, date: new Date("2026-08-01T00:00:00.000Z"), amount: 10, direction: "OUT" as const },
      { accountId: ACCOUNT_ID, date: new Date("2026-08-02T00:00:00.000Z"), amount: 20, direction: "IN" as const },
    ];
    const result = partitionNewTransactions(ACCOUNT_ID, parsed, existing);
    expect(result.toInsert).toEqual([]);
    expect(result.skipped).toEqual(parsed);
  });

  it("splits a partial overlap into the right buckets — the user's own August-statement example", () => {
    // A partial (15 Aug) upload already imported rows through 2026-08-15;
    // the full month's statement, uploaded later, re-covers those days
    // plus new ones through 2026-08-31.
    const existing = [{ accountId: ACCOUNT_ID, date: new Date("2026-08-10T00:00:00.000Z"), amount: 50, direction: "OUT" as const }];
    const parsed = [
      { date: "2026-08-10", amount: 50, direction: "OUT" as const }, // already imported
      { date: "2026-08-20", amount: 75, direction: "OUT" as const }, // new
    ];
    const result = partitionNewTransactions(ACCOUNT_ID, parsed, existing);
    expect(result.toInsert).toEqual([{ date: "2026-08-20", amount: 75, direction: "OUT" }]);
    expect(result.skipped).toEqual([{ date: "2026-08-10", amount: 50, direction: "OUT" }]);
  });

  it("matches only within the same account — a same date/amount/direction row on a different account isn't a duplicate", () => {
    const existing = [{ accountId: "acc-1", date: new Date("2026-08-01T00:00:00.000Z"), amount: 10, direction: "OUT" as const }];
    const parsed = [{ date: "2026-08-01", amount: 10, direction: "OUT" as const }];
    const result = partitionNewTransactions("acc-2", parsed, existing);
    expect(result.toInsert).toEqual(parsed);
    expect(result.skipped).toEqual([]);
  });

  it("keeps two genuinely distinct same-day/same-amount rows within one batch — never dedups against sibling rows in the same parse", () => {
    // Two identical £10 coffees on the same day, both new — the dedup key
    // can't tell them apart from each other, but it must never collapse
    // rows against each other within a single statement's own parse
    // (only against what's already in the DB), or a real second
    // transaction would be silently dropped.
    const parsed = [
      { date: "2026-08-01", amount: 10, direction: "OUT" as const },
      { date: "2026-08-01", amount: 10, direction: "OUT" as const },
    ];
    const result = partitionNewTransactions(ACCOUNT_ID, parsed, []);
    expect(result.toInsert).toEqual(parsed);
    expect(result.skipped).toEqual([]);
  });

  it("does not match on amount alone — a different amount on the same day/direction is a new transaction", () => {
    const existing = [{ accountId: ACCOUNT_ID, date: new Date("2026-08-01T00:00:00.000Z"), amount: 10, direction: "OUT" as const }];
    const parsed = [{ date: "2026-08-01", amount: 12, direction: "OUT" as const }];
    const result = partitionNewTransactions(ACCOUNT_ID, parsed, existing);
    expect(result.toInsert).toEqual(parsed);
    expect(result.skipped).toEqual([]);
  });
});

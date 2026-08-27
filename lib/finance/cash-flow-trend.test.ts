import { describe, expect, it } from "vitest";
import { cashFlowTrend } from "./cash-flow-trend";

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe("cashFlowTrend", () => {
  it("is empty for no transactions", () => {
    expect(cashFlowTrend([])).toEqual([]);
  });

  it("computes a running cumulative balance ordered by date", () => {
    const result = cashFlowTrend([
      { date: d("2026-08-03"), amount: 500, direction: "OUT" },
      { date: d("2026-08-01"), amount: 3000, direction: "IN" },
      { date: d("2026-08-02"), amount: 200, direction: "OUT" },
    ]);
    expect(result).toEqual([
      { date: d("2026-08-01"), cumulative: 3000 },
      { date: d("2026-08-02"), cumulative: 2800 },
      { date: d("2026-08-03"), cumulative: 2300 },
    ]);
  });

  it("sums same-day transactions into one point", () => {
    const result = cashFlowTrend([
      { date: d("2026-08-01"), amount: 1000, direction: "IN" },
      { date: d("2026-08-01"), amount: 100, direction: "OUT" },
    ]);
    expect(result).toEqual([{ date: d("2026-08-01"), cumulative: 900 }]);
  });

  it("includes a transaction flagged as a receivable — real cash still left the account", () => {
    const result = cashFlowTrend([
      { date: d("2026-08-01"), amount: 3000, direction: "IN" },
      { date: d("2026-08-02"), amount: 500, direction: "OUT" },
    ]);
    expect(result).toEqual([
      { date: d("2026-08-01"), cumulative: 3000 },
      { date: d("2026-08-02"), cumulative: 2500 },
    ]);
  });
});

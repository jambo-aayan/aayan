import { describe, expect, it } from "vitest";
import { categoryBreakdown } from "./category-breakdown";

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const month = d("2026-08-01");

describe("categoryBreakdown", () => {
  it("sums OUT transactions by category within the given month", () => {
    const result = categoryBreakdown(
      [
        { date: d("2026-08-05"), amount: 40, direction: "OUT", category: "Food", receivableId: null },
        { date: d("2026-08-12"), amount: 25, direction: "OUT", category: "Food", receivableId: null },
        { date: d("2026-08-20"), amount: 900, direction: "OUT", category: "Housing", receivableId: null },
      ],
      month
    );
    expect(result).toEqual([
      { category: "Housing", total: 900 },
      { category: "Food", total: 65 },
    ]);
  });

  it("excludes IN (income) transactions from the breakdown", () => {
    const result = categoryBreakdown(
      [
        { date: d("2026-08-05"), amount: 3000, direction: "IN", category: "Salary", receivableId: null },
        { date: d("2026-08-12"), amount: 40, direction: "OUT", category: "Food", receivableId: null },
      ],
      month
    );
    expect(result).toEqual([{ category: "Food", total: 40 }]);
  });

  it("excludes transactions outside the given calendar month", () => {
    const result = categoryBreakdown(
      [
        { date: d("2026-07-31"), amount: 40, direction: "OUT", category: "Food", receivableId: null },
        { date: d("2026-09-01"), amount: 40, direction: "OUT", category: "Food", receivableId: null },
        { date: d("2026-08-15"), amount: 40, direction: "OUT", category: "Food", receivableId: null },
      ],
      month
    );
    expect(result).toEqual([{ category: "Food", total: 40 }]);
  });

  it("sorts categories descending by total", () => {
    const result = categoryBreakdown(
      [
        { date: d("2026-08-01"), amount: 10, direction: "OUT", category: "Entertainment", receivableId: null },
        { date: d("2026-08-01"), amount: 900, direction: "OUT", category: "Housing", receivableId: null },
        { date: d("2026-08-01"), amount: 200, direction: "OUT", category: "Food", receivableId: null },
      ],
      month
    );
    expect(result.map((r) => r.category)).toEqual(["Housing", "Food", "Entertainment"]);
  });

  it("is empty when there are no matching transactions", () => {
    expect(categoryBreakdown([], month)).toEqual([]);
  });
});

describe("categoryBreakdown — receivable exclusion", () => {
  it("excludes a transaction flagged as a receivable from spend totals", () => {
    const result = categoryBreakdown(
      [
        { date: d("2026-08-05"), amount: 200, direction: "OUT", category: "Other", receivableId: "r1" },
        { date: d("2026-08-12"), amount: 40, direction: "OUT", category: "Food", receivableId: null },
      ],
      month
    );
    expect(result).toEqual([{ category: "Food", total: 40 }]);
  });
});

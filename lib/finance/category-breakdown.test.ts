import { describe, expect, it } from "vitest";
import { budgetVsActual, categoryBreakdown, projectedMonthEndSpend } from "./category-breakdown";

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const month = d("2026-08-01");

describe("categoryBreakdown", () => {
  it("sums OUT transactions by category within the given month", () => {
    const result = categoryBreakdown(
      [
        { date: d("2026-08-05"), amount: 40, direction: "OUT", category: "Food", receivableId: null, goalContributionId: null, transferId: null },
        { date: d("2026-08-12"), amount: 25, direction: "OUT", category: "Food", receivableId: null, goalContributionId: null, transferId: null },
        { date: d("2026-08-20"), amount: 900, direction: "OUT", category: "Housing", receivableId: null, goalContributionId: null, transferId: null },
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
        { date: d("2026-08-05"), amount: 3000, direction: "IN", category: "Salary", receivableId: null, goalContributionId: null, transferId: null },
        { date: d("2026-08-12"), amount: 40, direction: "OUT", category: "Food", receivableId: null, goalContributionId: null, transferId: null },
      ],
      month
    );
    expect(result).toEqual([{ category: "Food", total: 40 }]);
  });

  it("excludes transactions outside the given calendar month", () => {
    const result = categoryBreakdown(
      [
        { date: d("2026-07-31"), amount: 40, direction: "OUT", category: "Food", receivableId: null, goalContributionId: null, transferId: null },
        { date: d("2026-09-01"), amount: 40, direction: "OUT", category: "Food", receivableId: null, goalContributionId: null, transferId: null },
        { date: d("2026-08-15"), amount: 40, direction: "OUT", category: "Food", receivableId: null, goalContributionId: null, transferId: null },
      ],
      month
    );
    expect(result).toEqual([{ category: "Food", total: 40 }]);
  });

  it("sorts categories descending by total", () => {
    const result = categoryBreakdown(
      [
        { date: d("2026-08-01"), amount: 10, direction: "OUT", category: "Entertainment", receivableId: null, goalContributionId: null, transferId: null },
        { date: d("2026-08-01"), amount: 900, direction: "OUT", category: "Housing", receivableId: null, goalContributionId: null, transferId: null },
        { date: d("2026-08-01"), amount: 200, direction: "OUT", category: "Food", receivableId: null, goalContributionId: null, transferId: null },
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
        { date: d("2026-08-05"), amount: 200, direction: "OUT", category: "Other", receivableId: "r1", goalContributionId: null, transferId: null },
        { date: d("2026-08-12"), amount: 40, direction: "OUT", category: "Food", receivableId: null, goalContributionId: null, transferId: null },
      ],
      month
    );
    expect(result).toEqual([{ category: "Food", total: 40 }]);
  });
});

describe("categoryBreakdown — goal contribution exclusion", () => {
  it("excludes a transaction flagged as a goal contribution from spend totals", () => {
    const result = categoryBreakdown(
      [
        { date: d("2026-08-05"), amount: 200, direction: "OUT", category: "Other", receivableId: null, goalContributionId: "gc1", transferId: null },
        { date: d("2026-08-12"), amount: 40, direction: "OUT", category: "Food", receivableId: null, goalContributionId: null, transferId: null },
      ],
      month
    );
    expect(result).toEqual([{ category: "Food", total: 40 }]);
  });
});

describe("projectedMonthEndSpend", () => {
  it("extends the current pace to the full month", () => {
    expect(projectedMonthEndSpend(100, 10, 30)).toBe(300);
  });

  it("is null when no days have elapsed yet", () => {
    expect(projectedMonthEndSpend(0, 0, 30)).toBeNull();
  });
});

describe("budgetVsActual", () => {
  it("computes spend, remaining, and a projection for each budgeted category", () => {
    const transactions = [
      { date: d("2026-08-05"), amount: 100, direction: "OUT" as const, category: "Food", receivableId: null, goalContributionId: null, transferId: null },
      { date: d("2026-08-06"), amount: 50, direction: "OUT" as const, category: "Food", receivableId: null, goalContributionId: null, transferId: null },
    ];
    const result = budgetVsActual(transactions, month, [{ category: "Food", limit: 200 }], 10, 31);
    expect(result).toEqual([{ category: "Food", limit: 200, spent: 150, remaining: 50, projected: 465 }]);
  });

  it("reports zero spend for a budgeted category with no transactions", () => {
    const result = budgetVsActual([], month, [{ category: "Food", limit: 200 }], 10, 31);
    expect(result).toEqual([{ category: "Food", limit: 200, spent: 0, remaining: 200, projected: 0 }]);
  });

  it("reports a negative remaining when over budget", () => {
    const transactions = [
      { date: d("2026-08-05"), amount: 300, direction: "OUT" as const, category: "Food", receivableId: null, goalContributionId: null, transferId: null },
    ];
    const result = budgetVsActual(transactions, month, [{ category: "Food", limit: 200 }], 10, 31);
    expect(result[0].remaining).toBe(-100);
  });

  it("matches a budget category to transactions case/whitespace-insensitively", () => {
    const transactions = [
      { date: d("2026-08-05"), amount: 40, direction: "OUT" as const, category: "Food", receivableId: null, goalContributionId: null, transferId: null },
    ];
    const result = budgetVsActual(transactions, month, [{ category: " food ", limit: 200 }], 10, 31);
    expect(result[0].spent).toBe(40);
  });

  it("ignores an unbudgeted category entirely", () => {
    const transactions = [
      { date: d("2026-08-05"), amount: 40, direction: "OUT" as const, category: "Entertainment", receivableId: null, goalContributionId: null, transferId: null },
    ];
    expect(budgetVsActual(transactions, month, [{ category: "Food", limit: 200 }], 10, 31)).toEqual([
      { category: "Food", limit: 200, spent: 0, remaining: 200, projected: 0 },
    ]);
  });
});

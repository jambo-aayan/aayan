import { describe, expect, it } from "vitest";
import { categorySpendTrend } from "./category-spend";

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const base = { direction: "OUT" as const, receivableId: null, goalContributionId: null, transferId: null };

describe("categorySpendTrend", () => {
  it("builds one total per month, aligned with the given months array", () => {
    const rows = categorySpendTrend(
      [
        { ...base, date: d("2026-06-10"), amount: 40, category: "Dining Out", categoryParent: "Food" },
        { ...base, date: d("2026-07-10"), amount: 60, category: "Dining Out", categoryParent: "Food" },
      ],
      [d("2026-06-01"), d("2026-07-01"), d("2026-08-01")]
    );
    expect(rows).toEqual([{ category: "Dining Out", categoryParent: "Food", totals: [40, 60, 0], callout: null }]);
  });

  it("keeps same-named leaves under different parents as separate rows", () => {
    const rows = categorySpendTrend(
      [
        { ...base, date: d("2026-08-05"), amount: 40, category: "General", categoryParent: "Shopping" },
        { ...base, date: d("2026-08-06"), amount: 100, category: "General", categoryParent: "Travel" },
      ],
      [d("2026-08-01")]
    );
    expect(rows).toEqual([
      { category: "General", categoryParent: "Travel", totals: [100], callout: null },
      { category: "General", categoryParent: "Shopping", totals: [40], callout: null },
    ]);
  });

  it("flags the trend's last month with its own spend-deviation callout", () => {
    const rows = categorySpendTrend(
      [
        { ...base, date: d("2026-05-10"), amount: 100, category: "Dining Out", categoryParent: "Food" },
        { ...base, date: d("2026-06-10"), amount: 100, category: "Dining Out", categoryParent: "Food" },
        { ...base, date: d("2026-07-10"), amount: 100, category: "Dining Out", categoryParent: "Food" },
        { ...base, date: d("2026-08-10"), amount: 130, category: "Dining Out", categoryParent: "Food" },
      ],
      [d("2026-05-01"), d("2026-06-01"), d("2026-07-01"), d("2026-08-01")]
    );
    expect(rows[0].callout).toBe("more");
  });

  it("sorts rows by the last month's total, descending", () => {
    const rows = categorySpendTrend(
      [
        { ...base, date: d("2026-08-01"), amount: 10, category: "Streaming & Subscriptions", categoryParent: "Entertainment" },
        { ...base, date: d("2026-08-01"), amount: 900, category: "Rent/Mortgage", categoryParent: "Housing" },
      ],
      [d("2026-08-01")]
    );
    expect(rows.map((r) => r.category)).toEqual(["Rent/Mortgage", "Streaming & Subscriptions"]);
  });

  it("returns an empty array for no months", () => {
    expect(categorySpendTrend([], [])).toEqual([]);
  });

  it("returns an empty array for no transactions", () => {
    expect(categorySpendTrend([], [d("2026-08-01")])).toEqual([]);
  });
});

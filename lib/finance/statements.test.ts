import { describe, expect, it } from "vitest";
import {
  monthOverMonthDiff,
  savingsRate,
  categoryTimeSeries,
  topMerchants,
  detectRecurringCharges,
  detectAnomalies,
  yearOverYearComparison,
  accountFreshness,
} from "./statements";

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

function tx(overrides: Partial<Parameters<typeof topMerchants>[0][number]> = {}) {
  return {
    id: "t1",
    date: d("2026-08-01"),
    amount: 40,
    direction: "OUT" as const,
    category: "Food",
    source: "Tesco",
    receivableId: null,
    goalContributionId: null,
    ...overrides,
  };
}

describe("monthOverMonthDiff", () => {
  it("computes the spend diff between two months", () => {
    const transactions = [
      tx({ id: "a", date: d("2026-08-05"), amount: 100 }),
      tx({ id: "b", date: d("2026-07-05"), amount: 80 }),
    ];
    const result = monthOverMonthDiff(transactions, d("2026-08-01"), d("2026-07-01"));
    expect(result).toEqual({ currentTotal: 100, previousTotal: 80, diffAmount: 20, diffPercent: 25 });
  });

  it("returns a null diffPercent when the previous month had no spend", () => {
    const transactions = [tx({ id: "a", date: d("2026-08-05"), amount: 100 })];
    const result = monthOverMonthDiff(transactions, d("2026-08-01"), d("2026-07-01"));
    expect(result).toEqual({ currentTotal: 100, previousTotal: 0, diffAmount: 100, diffPercent: null });
  });

  it("excludes receivable-flagged transactions from both months", () => {
    const transactions = [
      tx({ id: "a", date: d("2026-08-05"), amount: 100, receivableId: "r1" }),
      tx({ id: "b", date: d("2026-08-06"), amount: 50 }),
    ];
    const result = monthOverMonthDiff(transactions, d("2026-08-01"), d("2026-07-01"));
    expect(result.currentTotal).toBe(50);
  });

  it("excludes goal-contribution-flagged transactions from both months", () => {
    const transactions = [
      tx({ id: "a", date: d("2026-08-05"), amount: 100, goalContributionId: "gc1" }),
      tx({ id: "b", date: d("2026-08-06"), amount: 50 }),
    ];
    const result = monthOverMonthDiff(transactions, d("2026-08-01"), d("2026-07-01"));
    expect(result.currentTotal).toBe(50);
  });
});

describe("savingsRate", () => {
  it("computes the percentage of income not spent", () => {
    expect(savingsRate(2000, 1500)).toBe(25);
  });

  it("is null when income is zero", () => {
    expect(savingsRate(0, 100)).toBeNull();
  });

  it("can go negative when spend exceeds income", () => {
    expect(savingsRate(1000, 1200)).toBe(-20);
  });
});

describe("categoryTimeSeries", () => {
  it("aligns one row per category across the given months", () => {
    const transactions = [
      tx({ id: "a", category: "Food", amount: 40, date: d("2026-08-05") }),
      tx({ id: "b", category: "Housing", amount: 900, date: d("2026-08-05") }),
      tx({ id: "c", category: "Food", amount: 20, date: d("2026-07-05") }),
    ];
    const result = categoryTimeSeries(transactions, [d("2026-07-01"), d("2026-08-01")]);
    expect(result).toEqual([
      { category: "Food", totals: [20, 40] },
      { category: "Housing", totals: [0, 900] },
    ]);
  });

  it("is empty for no transactions", () => {
    expect(categoryTimeSeries([], [d("2026-08-01")])).toEqual([]);
  });
});

describe("topMerchants", () => {
  it("sums spend by source, sorted descending", () => {
    const transactions = [
      tx({ id: "a", source: "Tesco", amount: 40 }),
      tx({ id: "b", source: "Tesco", amount: 30 }),
      tx({ id: "c", source: "Amazon", amount: 900 }),
    ];
    const result = topMerchants(transactions, 5);
    expect(result).toEqual([
      { source: "Amazon", total: 900, count: 1 },
      { source: "Tesco", total: 70, count: 2 },
    ]);
  });

  it("excludes IN transactions and receivable-flagged ones", () => {
    const transactions = [
      tx({ id: "a", direction: "IN", source: "Salary", amount: 3000 }),
      tx({ id: "b", source: "Tesco", amount: 40, receivableId: "r1" }),
      tx({ id: "c", source: "Tesco", amount: 20 }),
    ];
    expect(topMerchants(transactions, 5)).toEqual([{ source: "Tesco", total: 20, count: 1 }]);
  });

  it("groups a null source under Unknown", () => {
    const transactions = [tx({ id: "a", source: null, amount: 10 })];
    expect(topMerchants(transactions, 5)).toEqual([{ source: "Unknown", total: 10, count: 1 }]);
  });

  it("caps at the given limit", () => {
    const transactions = [
      tx({ id: "a", source: "A", amount: 30 }),
      tx({ id: "b", source: "B", amount: 20 }),
      tx({ id: "c", source: "C", amount: 10 }),
    ];
    expect(topMerchants(transactions, 2).map((m) => m.source)).toEqual(["A", "B"]);
  });
});

describe("detectRecurringCharges", () => {
  it("flags a source+amount pair recurring across 2+ distinct calendar months", () => {
    const transactions = [
      tx({ id: "a", source: "Netflix", amount: 12, date: d("2026-06-01") }),
      tx({ id: "b", source: "Netflix", amount: 12, date: d("2026-07-01") }),
      tx({ id: "c", source: "Netflix", amount: 12, date: d("2026-08-01") }),
    ];
    const result = detectRecurringCharges(transactions);
    expect(result).toEqual([{ source: "Netflix", amount: 12, occurrences: 3 }]);
  });

  it("does not flag a one-off, even if it repeats within the same month", () => {
    const transactions = [
      tx({ id: "a", source: "Coffee", amount: 3, date: d("2026-08-01") }),
      tx({ id: "b", source: "Coffee", amount: 3, date: d("2026-08-15") }),
    ];
    expect(detectRecurringCharges(transactions)).toEqual([]);
  });

  it("does not flag amounts that differ between occurrences", () => {
    const transactions = [
      tx({ id: "a", source: "Netflix", amount: 12, date: d("2026-06-01") }),
      tx({ id: "b", source: "Netflix", amount: 15, date: d("2026-07-01") }),
    ];
    expect(detectRecurringCharges(transactions)).toEqual([]);
  });
});

describe("detectAnomalies", () => {
  it("flags a transaction well above its category's typical amount", () => {
    const transactions = [
      tx({ id: "a", category: "Food", amount: 20 }),
      tx({ id: "b", category: "Food", amount: 25 }),
      tx({ id: "c", category: "Food", amount: 22 }),
      tx({ id: "d", category: "Food", amount: 200 }),
    ];
    expect(detectAnomalies(transactions)).toEqual(["d"]);
  });

  it("flags nothing when a category has too few data points to judge", () => {
    const transactions = [
      tx({ id: "a", category: "Food", amount: 20 }),
      tx({ id: "b", category: "Food", amount: 200 }),
    ];
    expect(detectAnomalies(transactions)).toEqual([]);
  });

  it("judges a transaction against the OTHER amounts, not a mean it inflates itself", () => {
    // A naive mean-including-self here would be (10*4+100)/5=28, and
    // 100 > 28*2=56 would still flag it — but with more near-identical
    // small values diluting a single spike further, self-inclusion can
    // hide the very outlier it should catch. Excluding the candidate
    // from its own mean (others: 10,10,10,10 -> mean 10) catches it
    // reliably regardless of how many other points there are.
    const transactions = [
      tx({ id: "a", category: "Food", amount: 10 }),
      tx({ id: "b", category: "Food", amount: 10 }),
      tx({ id: "c", category: "Food", amount: 10 }),
      tx({ id: "d", category: "Food", amount: 10 }),
      tx({ id: "e", category: "Food", amount: 100 }),
    ];
    expect(detectAnomalies(transactions)).toEqual(["e"]);
  });
});

describe("yearOverYearComparison", () => {
  it("is null without a full year of prior data", () => {
    const transactions = [tx({ id: "a", date: d("2026-08-05"), amount: 100 })];
    expect(yearOverYearComparison(transactions, d("2026-08-01"))).toBeNull();
  });

  it("compares the same calendar month a year apart once both exist", () => {
    const transactions = [
      tx({ id: "a", date: d("2026-08-05"), amount: 100 }),
      tx({ id: "b", date: d("2025-08-10"), amount: 80 }),
    ];
    const result = yearOverYearComparison(transactions, d("2026-08-01"));
    expect(result).toEqual({ currentTotal: 100, priorYearTotal: 80, diffPercent: 25 });
  });
});

describe("accountFreshness", () => {
  it("flags an account stale after the threshold with no recent snapshot", () => {
    const accounts = [{ id: "1", name: "Lloyds", lastUpdated: d("2026-06-01") }];
    const result = accountFreshness(accounts, d("2026-08-27"), 45);
    expect(result).toEqual([{ id: "1", name: "Lloyds", lastUpdated: d("2026-06-01"), stale: true }]);
  });

  it("does not flag a recently updated account", () => {
    const accounts = [{ id: "1", name: "Lloyds", lastUpdated: d("2026-08-20") }];
    const result = accountFreshness(accounts, d("2026-08-27"), 45);
    expect(result[0].stale).toBe(false);
  });

  it("flags an account with no snapshot at all as stale", () => {
    const accounts = [{ id: "1", name: "Lloyds", lastUpdated: null }];
    const result = accountFreshness(accounts, d("2026-08-27"), 45);
    expect(result[0].stale).toBe(true);
  });
});

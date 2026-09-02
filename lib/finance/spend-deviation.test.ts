import { describe, expect, it } from "vitest";
import { categorySpendDeviation, totalSpendDeviation } from "./spend-deviation";

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const month = d("2026-08-01");

function tx(
  dateIso: string,
  amount: number,
  category: string,
  opts: { receivableId?: string | null; goalContributionId?: string | null; categoryParent?: string } = {}
) {
  return {
    date: d(dateIso),
    amount,
    direction: "OUT" as const,
    category,
    categoryParent: opts.categoryParent ?? category,
    receivableId: opts.receivableId ?? null,
    goalContributionId: opts.goalContributionId ?? null,
    transferId: null,
  };
}

describe("categorySpendDeviation", () => {
  it("flags a category spending notably more than its 3-month baseline", () => {
    const result = categorySpendDeviation(
      [
        tx("2026-05-10", 100, "Food"),
        tx("2026-06-10", 100, "Food"),
        tx("2026-07-10", 100, "Food"),
        tx("2026-08-10", 130, "Food"),
      ],
      month
    );
    expect(result).toEqual([
      { category: "Food", categoryParent: "Food", current: 130, baseline: 100, diffAmount: 30, diffPercent: 30, callout: "more" },
    ]);
  });

  it("flags a category spending notably less than its 3-month baseline", () => {
    const result = categorySpendDeviation(
      [
        tx("2026-05-10", 100, "Food"),
        tx("2026-06-10", 100, "Food"),
        tx("2026-07-10", 100, "Food"),
        tx("2026-08-10", 70, "Food"),
      ],
      month
    );
    expect(result[0]).toMatchObject({ diffPercent: -30, callout: "less" });
  });

  it("does not callout a swing within the +/-20% band", () => {
    const result = categorySpendDeviation(
      [
        tx("2026-05-10", 100, "Food"),
        tx("2026-06-10", 100, "Food"),
        tx("2026-07-10", 100, "Food"),
        tx("2026-08-10", 110, "Food"),
      ],
      month
    );
    expect(result[0]).toMatchObject({ diffPercent: 10, callout: null });
  });

  it("omits a category with fewer than 3 qualifying prior months", () => {
    const result = categorySpendDeviation(
      [
        tx("2026-06-10", 100, "Food"),
        tx("2026-07-10", 100, "Food"),
        tx("2026-08-10", 130, "Food"),
      ],
      month
    );
    expect(result).toEqual([]);
  });

  it("omits a category with a qualifying month at exactly zero spend", () => {
    const result = categorySpendDeviation(
      [
        tx("2026-05-10", 100, "Food"),
        // No July transaction at all -> July total is 0 for Food.
        tx("2026-06-10", 100, "Food"),
        tx("2026-08-10", 130, "Food"),
      ],
      month
    );
    expect(result).toEqual([]);
  });

  it("excludes receivable- and goal-contribution-flagged transactions from both baseline and current spend", () => {
    const result = categorySpendDeviation(
      [
        tx("2026-05-10", 100, "Food"),
        tx("2026-06-10", 100, "Food"),
        tx("2026-07-10", 100, "Food"),
        tx("2026-07-10", 500, "Food", { receivableId: "rec-1" }),
        tx("2026-08-10", 100, "Food"),
        tx("2026-08-10", 900, "Food", { goalContributionId: "goal-1" }),
      ],
      month
    );
    expect(result).toEqual([
      { category: "Food", categoryParent: "Food", current: 100, baseline: 100, diffAmount: 0, diffPercent: 0, callout: null },
    ]);
  });
});

describe("totalSpendDeviation", () => {
  it("flags whole-month spend notably more than its 3-month baseline", () => {
    const result = totalSpendDeviation(
      [
        tx("2026-05-10", 100, "Food"),
        tx("2026-06-10", 100, "Housing"),
        tx("2026-07-10", 100, "Transport"),
        tx("2026-08-10", 130, "Food"),
      ],
      month
    );
    expect(result).toEqual({ current: 130, baseline: 100, diffAmount: 30, diffPercent: 30, callout: "more" });
  });

  it("returns null when any of the 3 preceding months has zero spend", () => {
    const result = totalSpendDeviation(
      [
        tx("2026-05-10", 100, "Food"),
        // June has no transactions at all.
        tx("2026-07-10", 100, "Food"),
        tx("2026-08-10", 130, "Food"),
      ],
      month
    );
    expect(result).toBeNull();
  });

  it("excludes receivable- and goal-contribution-flagged transactions", () => {
    const result = totalSpendDeviation(
      [
        tx("2026-05-10", 100, "Food"),
        tx("2026-06-10", 100, "Food"),
        tx("2026-07-10", 100, "Food"),
        tx("2026-07-10", 500, "Food", { receivableId: "rec-1" }),
        tx("2026-08-10", 100, "Food"),
        tx("2026-08-10", 900, "Food", { goalContributionId: "goal-1" }),
      ],
      month
    );
    expect(result).toEqual({ current: 100, baseline: 100, diffAmount: 0, diffPercent: 0, callout: null });
  });
});

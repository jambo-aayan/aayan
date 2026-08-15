import { describe, expect, it } from "vitest";
import { goalProgressPercent, projectedCompletionDate, totalMonthlyContributions, isOvercommitted } from "./goal-math";

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe("goalProgressPercent", () => {
  it("is the saved/target ratio as a percentage", () => {
    expect(goalProgressPercent(4200, 6000)).toBe(70);
  });

  it("clamps at 100 when saved exceeds target", () => {
    expect(goalProgressPercent(7000, 6000)).toBe(100);
  });

  it("is 0 when target is 0 (avoids divide-by-zero)", () => {
    expect(goalProgressPercent(100, 0)).toBe(0);
  });
});

describe("projectedCompletionDate", () => {
  it("projects forward by the months needed at the current contribution rate", () => {
    // 1800 remaining / 300 per month = 6 months
    const result = projectedCompletionDate(4200, 6000, 300, d("2026-01-01"));
    expect(result?.toISOString()).toBe(d("2026-07-01").toISOString());
  });

  it("is null when the goal is already met", () => {
    expect(projectedCompletionDate(6000, 6000, 300, d("2026-01-01"))).toBeNull();
  });

  it("is null when monthly contribution is zero (never completes)", () => {
    expect(projectedCompletionDate(0, 6000, 0, d("2026-01-01"))).toBeNull();
  });
});

describe("totalMonthlyContributions", () => {
  it("sums contributions across goals", () => {
    expect(totalMonthlyContributions([{ monthlyContribution: 300 }, { monthlyContribution: 150 }])).toBe(450);
  });

  it("is 0 for no goals", () => {
    expect(totalMonthlyContributions([])).toBe(0);
  });
});

describe("isOvercommitted", () => {
  it("is true when committed contributions exceed surplus", () => {
    expect(isOvercommitted(900, 850)).toBe(true);
  });

  it("is false when contributions are within surplus", () => {
    expect(isOvercommitted(800, 850)).toBe(false);
  });

  it("is false when contributions exactly equal surplus", () => {
    expect(isOvercommitted(850, 850)).toBe(false);
  });
});

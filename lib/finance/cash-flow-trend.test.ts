import { describe, expect, it } from "vitest";
import { cashFlowTrend, nearestCashFlowPoint } from "./cash-flow-trend";

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

const POINTS = [
  { date: new Date("2026-01-01"), cumulative: 0 },
  { date: new Date("2026-01-02"), cumulative: 50 },
  { date: new Date("2026-01-03"), cumulative: 30 },
  { date: new Date("2026-01-04"), cumulative: 100 },
];

describe("nearestCashFlowPoint", () => {
  it("returns null for an empty series", () => {
    expect(nearestCashFlowPoint([], 50, 400)).toBeNull();
  });

  it("returns the single point regardless of x, for a one-point series", () => {
    const result = nearestCashFlowPoint([POINTS[0]], 999, 400);
    expect(result).toEqual({ ...POINTS[0], index: 0 });
  });

  it("clamps to the first point before x=0", () => {
    expect(nearestCashFlowPoint(POINTS, -50, 400)?.index).toBe(0);
  });

  it("clamps to the last point after the chart width", () => {
    expect(nearestCashFlowPoint(POINTS, 999, 400)?.index).toBe(3);
  });

  it("resolves exactly on a point", () => {
    // 4 points evenly spaced across width 400 => index 1 sits at x=133.3
    expect(nearestCashFlowPoint(POINTS, 400 / 3, 400)?.index).toBe(1);
  });

  it("rounds to the nearest point between two points", () => {
    // Halfway between index 1 (x=133.3) and index 2 (x=266.7) rounds to whichever is closer
    expect(nearestCashFlowPoint(POINTS, 150, 400)?.index).toBe(1);
    expect(nearestCashFlowPoint(POINTS, 250, 400)?.index).toBe(2);
  });

  it("returns the point's own date and cumulative value", () => {
    expect(nearestCashFlowPoint(POINTS, 400, 400)).toEqual({ ...POINTS[3], index: 3 });
  });
});

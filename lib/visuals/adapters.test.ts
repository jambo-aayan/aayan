import { describe, expect, it } from "vitest";
import { balancePoints, checkinPoints, evaluationPoints, goalProgressPoints, joinBoundWithManual, joinPointsByDate } from "./adapters";

describe("checkinPoints", () => {
  it("maps FULL to 1 and MINIMUM to 0.5, sorted chronologically", () => {
    const points = checkinPoints([
      { date: new Date("2026-01-02"), level: "MINIMUM" },
      { date: new Date("2026-01-01"), level: "FULL" },
    ]);
    expect(points).toEqual([
      { date: new Date("2026-01-01"), value: 1 },
      { date: new Date("2026-01-02"), value: 0.5 },
    ]);
  });
});

describe("evaluationPoints", () => {
  it("averages the three ratings", () => {
    const points = evaluationPoints([
      { date: new Date("2026-01-01"), effectiveness: 4, consistency: 5, sustainability: 3 },
    ]);
    expect(points).toEqual([{ date: new Date("2026-01-01"), value: 4 }]);
  });
});

describe("goalProgressPoints", () => {
  it("returns a running cumulative total, sorted chronologically", () => {
    const points = goalProgressPoints([
      { date: new Date("2026-01-02"), amount: 50 },
      { date: new Date("2026-01-01"), amount: 100 },
    ]);
    expect(points).toEqual([
      { date: new Date("2026-01-01"), value: 100 },
      { date: new Date("2026-01-02"), value: 150 },
    ]);
  });

  it("merges same-day contributions into one point", () => {
    const points = goalProgressPoints([
      { date: new Date("2026-01-01"), amount: 100 },
      { date: new Date("2026-01-01"), amount: 25 },
      { date: new Date("2026-01-02"), amount: 50 },
    ]);
    expect(points).toEqual([
      { date: new Date("2026-01-01"), value: 125 },
      { date: new Date("2026-01-02"), value: 175 },
    ]);
  });
});

describe("balancePoints", () => {
  it("maps snapshots to date+value, sorted chronologically", () => {
    const points = balancePoints([
      { date: new Date("2026-01-02"), balance: 900 },
      { date: new Date("2026-01-01"), balance: 1000 },
    ]);
    expect(points).toEqual([
      { date: new Date("2026-01-01"), value: 1000 },
      { date: new Date("2026-01-02"), value: 900 },
    ]);
  });
});

describe("joinPointsByDate", () => {
  it("pairs X and Y points sharing the exact same date", () => {
    const xPoints = [
      { date: new Date("2026-01-01"), value: 1 },
      { date: new Date("2026-01-02"), value: 2 },
    ];
    const yPoints = [
      { date: new Date("2026-01-01"), value: 10 },
      { date: new Date("2026-01-02"), value: 20 },
    ];
    expect(joinPointsByDate(xPoints, yPoints)).toEqual([
      { x: 1, y: 10 },
      { x: 2, y: 20 },
    ]);
  });

  it("drops a date present in only one series", () => {
    const xPoints = [
      { date: new Date("2026-01-01"), value: 1 },
      { date: new Date("2026-01-02"), value: 2 },
    ];
    const yPoints = [{ date: new Date("2026-01-01"), value: 10 }];
    expect(joinPointsByDate(xPoints, yPoints)).toEqual([{ x: 1, y: 10 }]);
  });

  it("returns an empty array when there's no overlap", () => {
    expect(joinPointsByDate([{ date: new Date("2026-01-01"), value: 1 }], [{ date: new Date("2026-01-02"), value: 10 }])).toEqual(
      []
    );
  });

  it("sorts the joined pairs chronologically by X's own date", () => {
    const xPoints = [
      { date: new Date("2026-01-02"), value: 2 },
      { date: new Date("2026-01-01"), value: 1 },
    ];
    const yPoints = [
      { date: new Date("2026-01-01"), value: 10 },
      { date: new Date("2026-01-02"), value: 20 },
    ];
    expect(joinPointsByDate(xPoints, yPoints)).toEqual([
      { x: 1, y: 10 },
      { x: 2, y: 20 },
    ]);
  });
});

describe("joinBoundWithManual", () => {
  it("pairs the Nth manual value with the Nth bound point, sorted chronologically", () => {
    const boundPoints = [
      { date: new Date("2026-01-02"), value: 20 },
      { date: new Date("2026-01-01"), value: 10 },
    ];
    expect(joinBoundWithManual(boundPoints, [100, 200])).toEqual([
      { bound: 10, manual: 100 },
      { bound: 20, manual: 200 },
    ]);
  });

  it("truncates to the shorter series, leaving an unpaired tail out", () => {
    const boundPoints = [{ date: new Date("2026-01-01"), value: 10 }, { date: new Date("2026-01-02"), value: 20 }];
    expect(joinBoundWithManual(boundPoints, [100])).toEqual([{ bound: 10, manual: 100 }]);
    expect(joinBoundWithManual([{ date: new Date("2026-01-01"), value: 10 }], [100, 200])).toEqual([
      { bound: 10, manual: 100 },
    ]);
  });

  it("returns an empty array when either series is empty", () => {
    expect(joinBoundWithManual([], [100])).toEqual([]);
    expect(joinBoundWithManual([{ date: new Date("2026-01-01"), value: 10 }], [])).toEqual([]);
  });
});

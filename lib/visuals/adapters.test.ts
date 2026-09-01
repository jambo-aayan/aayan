import { describe, expect, it } from "vitest";
import { balancePoints, checkinPoints, evaluationPoints, goalProgressPoints } from "./adapters";

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

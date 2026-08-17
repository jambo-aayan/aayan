import { describe, it, expect } from "vitest";
import { dailyFocusPercent } from "./daily-focus";

describe("dailyFocusPercent", () => {
  it("is null with no active habits", () => {
    expect(dailyFocusPercent([])).toBeNull();
  });

  it("is 0 when nothing is checked in yet", () => {
    expect(dailyFocusPercent([{ id: "a", todayLevel: null }, { id: "b", todayLevel: null }])).toBe(0);
  });

  it("is 100 when everything is checked in", () => {
    expect(dailyFocusPercent([{ id: "a", todayLevel: "FULL" }, { id: "b", todayLevel: "MINIMUM" }])).toBe(100);
  });

  it("rounds a partial completion rate", () => {
    expect(
      dailyFocusPercent([
        { id: "a", todayLevel: "FULL" },
        { id: "b", todayLevel: null },
        { id: "c", todayLevel: null },
      ])
    ).toBe(33);
  });
});

import { describe, expect, it } from "vitest";
import { netWorth } from "./net-worth";

describe("netWorth", () => {
  it("sums assets and subtracts liabilities for total", () => {
    const result = netWorth([
      { value: 10000, type: "ASSET", excluded: false },
      { value: 2000, type: "LIABILITY", excluded: false },
    ]);
    expect(result.total).toBe(8000);
  });

  it("excludes items flagged excluded from accessible, but not total", () => {
    const result = netWorth([
      { value: 10000, type: "ASSET", excluded: false }, // e.g. cash
      { value: 50000, type: "ASSET", excluded: true }, // e.g. pension
    ]);
    expect(result.accessible).toBe(10000);
    expect(result.total).toBe(60000);
  });

  it("returns zero for both figures with no items", () => {
    expect(netWorth([])).toEqual({ accessible: 0, total: 0 });
  });

  it("drops an excluded liability from accessible too, not just excluded assets", () => {
    const result = netWorth([
      { value: 10000, type: "ASSET", excluded: false },
      { value: 3000, type: "LIABILITY", excluded: true },
    ]);
    expect(result.accessible).toBe(10000); // liability excluded from accessible entirely
    expect(result.total).toBe(7000); // total still counts every item regardless of excluded
  });
});

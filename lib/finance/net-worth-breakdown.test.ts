import { describe, expect, it } from "vitest";
import { netWorthBreakdown } from "./net-worth-breakdown";

describe("netWorthBreakdown", () => {
  it("returns one segment per asset item, sorted by value descending", () => {
    const result = netWorthBreakdown([
      { name: "Cash", value: 5000, type: "ASSET", excluded: false },
      { name: "LISA", value: 8000, type: "ASSET", excluded: false },
    ]);
    expect(result.map((s) => s.name)).toEqual(["LISA", "Cash"]);
  });

  it("excludes liabilities — a breakdown ring can't show negative slices", () => {
    const result = netWorthBreakdown([
      { name: "Cash", value: 5000, type: "ASSET", excluded: false },
      { name: "Credit card", value: 800, type: "LIABILITY", excluded: false },
    ]);
    expect(result).toEqual([{ name: "Cash", value: 5000 }]);
  });

  it("excludes items flagged excluded (e.g. pension), matching the accessible net-worth figure", () => {
    const result = netWorthBreakdown([
      { name: "Cash", value: 5000, type: "ASSET", excluded: false },
      { name: "Pension", value: 40000, type: "ASSET", excluded: true },
    ]);
    expect(result).toEqual([{ name: "Cash", value: 5000 }]);
  });

  it("is empty with no eligible items", () => {
    expect(netWorthBreakdown([])).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import { netWorthBreakdown } from "./net-worth-breakdown";

describe("netWorthBreakdown", () => {
  it("returns one segment per asset account, sorted by value descending, when no class is set", () => {
    const result = netWorthBreakdown([
      { name: "Cash", value: 5000, type: "ASSET", excluded: false, cls: null },
      { name: "LISA", value: 8000, type: "ASSET", excluded: false, cls: null },
    ]);
    expect(result.map((s) => s.name)).toEqual(["LISA", "Cash"]);
  });

  it("groups accounts sharing a class, summing their values into one segment", () => {
    const result = netWorthBreakdown([
      { name: "Lloyds current", value: 2000, type: "ASSET", excluded: false, cls: "Cash" },
      { name: "Savings pot", value: 3000, type: "ASSET", excluded: false, cls: "Cash" },
      { name: "LISA", value: 8000, type: "ASSET", excluded: false, cls: "Investments" },
    ]);
    expect(result).toEqual([
      { name: "Investments", value: 8000 },
      { name: "Cash", value: 5000 },
    ]);
  });

  it("excludes liabilities — a breakdown ring can't show negative slices", () => {
    const result = netWorthBreakdown([
      { name: "Cash", value: 5000, type: "ASSET", excluded: false, cls: null },
      { name: "Credit card", value: 800, type: "LIABILITY", excluded: false, cls: null },
    ]);
    expect(result).toEqual([{ name: "Cash", value: 5000 }]);
  });

  it("excludes accounts flagged excluded (e.g. pension), matching the accessible net-worth figure", () => {
    const result = netWorthBreakdown([
      { name: "Cash", value: 5000, type: "ASSET", excluded: false, cls: null },
      { name: "Pension", value: 40000, type: "ASSET", excluded: true, cls: null },
    ]);
    expect(result).toEqual([{ name: "Cash", value: 5000 }]);
  });

  it("is empty with no eligible accounts", () => {
    expect(netWorthBreakdown([])).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import { parseChartBinding, parseProgressBarConfig, parseScatterBinding, parseTableBinding, progressPercent } from "./config";

describe("parseProgressBarConfig", () => {
  it("returns the target when config is a valid shape", () => {
    expect(parseProgressBarConfig({ target: 50 })).toEqual({ target: 50 });
  });

  it("returns null for an empty object (no target set yet)", () => {
    expect(parseProgressBarConfig({})).toBeNull();
  });

  it("returns null for null/non-object config", () => {
    expect(parseProgressBarConfig(null)).toBeNull();
    expect(parseProgressBarConfig("not an object")).toBeNull();
    expect(parseProgressBarConfig(42)).toBeNull();
  });

  it("returns null when target is not a finite number", () => {
    expect(parseProgressBarConfig({ target: "50" })).toBeNull();
    expect(parseProgressBarConfig({ target: NaN })).toBeNull();
    expect(parseProgressBarConfig({ target: Infinity })).toBeNull();
  });
});

describe("parseChartBinding", () => {
  it("returns the adapter+refId for a valid binding", () => {
    expect(parseChartBinding({ binding: { adapter: "habit-checkins", refId: "h1" } })).toEqual({
      adapter: "habit-checkins",
      refId: "h1",
    });
  });

  it("returns null when there's no binding key (an ad-hoc chart)", () => {
    expect(parseChartBinding({})).toBeNull();
    expect(parseChartBinding({ target: 50 })).toBeNull();
  });

  it("returns null for null/non-object config", () => {
    expect(parseChartBinding(null)).toBeNull();
    expect(parseChartBinding("not an object")).toBeNull();
  });

  it("returns null for an unrecognized adapter name", () => {
    expect(parseChartBinding({ binding: { adapter: "made-up", refId: "x" } })).toBeNull();
  });

  it("returns null when refId is missing or empty", () => {
    expect(parseChartBinding({ binding: { adapter: "goal-progress" } })).toBeNull();
    expect(parseChartBinding({ binding: { adapter: "goal-progress", refId: "" } })).toBeNull();
  });
});

describe("parseScatterBinding", () => {
  it("returns both axis bindings when both are valid", () => {
    expect(
      parseScatterBinding({
        xBinding: { adapter: "habit-checkins", refId: "h1" },
        yBinding: { adapter: "system-evaluations", refId: "s1" },
      })
    ).toEqual({
      x: { adapter: "habit-checkins", refId: "h1" },
      y: { adapter: "system-evaluations", refId: "s1" },
    });
  });

  it("returns a mixed binding (one axis bound, the other left null) when only one axis is bound", () => {
    expect(parseScatterBinding({ xBinding: { adapter: "habit-checkins", refId: "h1" } })).toEqual({
      x: { adapter: "habit-checkins", refId: "h1" },
      y: null,
    });
    expect(parseScatterBinding({ yBinding: { adapter: "habit-checkins", refId: "h1" } })).toEqual({
      x: null,
      y: { adapter: "habit-checkins", refId: "h1" },
    });
  });

  it("returns null for null/non-object config or an ad-hoc chart's config", () => {
    expect(parseScatterBinding(null)).toBeNull();
    expect(parseScatterBinding({})).toBeNull();
  });
});

describe("parseTableBinding", () => {
  it("returns the adapter for a valid table binding", () => {
    expect(parseTableBinding({ tableBinding: { adapter: "goals" } })).toEqual({ adapter: "goals" });
    expect(parseTableBinding({ tableBinding: { adapter: "habits" } })).toEqual({ adapter: "habits" });
    expect(parseTableBinding({ tableBinding: { adapter: "tasks" } })).toEqual({ adapter: "tasks" });
    expect(parseTableBinding({ tableBinding: { adapter: "systems" } })).toEqual({ adapter: "systems" });
  });

  it("returns null for a freeform table's config (no tableBinding key)", () => {
    expect(parseTableBinding({})).toBeNull();
  });

  it("returns null for null/non-object config", () => {
    expect(parseTableBinding(null)).toBeNull();
    expect(parseTableBinding("not an object")).toBeNull();
  });

  it("returns null for an unrecognized adapter name", () => {
    expect(parseTableBinding({ tableBinding: { adapter: "made-up" } })).toBeNull();
  });
});

describe("progressPercent", () => {
  it("is the current/target ratio as a rounded percentage", () => {
    expect(progressPercent(4200, 6000)).toBe(70);
  });

  it("clamps at 100 when current exceeds target", () => {
    expect(progressPercent(7000, 6000)).toBe(100);
  });

  it("does NOT clamp a negative current — Finance's net-worth-backed goal ring needs a real negative percent, not a floor", () => {
    expect(progressPercent(-600, 6000)).toBe(-10);
  });

  it("is 0 when target is 0 or negative (avoids divide-by-zero)", () => {
    expect(progressPercent(100, 0)).toBe(0);
    expect(progressPercent(100, -10)).toBe(0);
  });

  it("rounds to the nearest whole percent", () => {
    expect(progressPercent(1, 3)).toBe(33);
  });
});

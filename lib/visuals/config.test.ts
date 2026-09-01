import { describe, expect, it } from "vitest";
import { parseChartBinding, parseProgressBarConfig, parseScatterBinding } from "./config";

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

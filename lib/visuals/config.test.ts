import { describe, expect, it } from "vitest";
import { parseProgressBarConfig } from "./config";

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

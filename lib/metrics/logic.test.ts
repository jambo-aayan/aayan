import { describe, expect, it } from "vitest";
import { validateMetricInput } from "./logic";

describe("validateMetricInput", () => {
  it("requires a name", () => {
    expect(validateMetricInput({ name: "", valueType: "NUMBER" })).toBe("Enter a name.");
    expect(validateMetricInput({ name: "   ", valueType: "NUMBER" })).toBe("Enter a name.");
  });

  it("accepts a valid NUMBER metric", () => {
    expect(validateMetricInput({ name: "Weight", valueType: "NUMBER" })).toBeNull();
  });

  it("accepts a valid SCALE_5 metric", () => {
    expect(validateMetricInput({ name: "Mood", valueType: "SCALE_5" })).toBeNull();
  });

  it("accepts a valid BOOLEAN metric", () => {
    expect(validateMetricInput({ name: "Trained today", valueType: "BOOLEAN" })).toBeNull();
  });

  it("accepts a valid TEXT metric", () => {
    expect(validateMetricInput({ name: "Notes", valueType: "TEXT" })).toBeNull();
  });

  it("requires at least 2 options for an ENUM metric", () => {
    expect(validateMetricInput({ name: "Headache", valueType: "ENUM", enumOptions: null })).toBe(
      "Enum metrics need at least 2 options."
    );
    expect(validateMetricInput({ name: "Headache", valueType: "ENUM", enumOptions: [] })).toBe(
      "Enum metrics need at least 2 options."
    );
    expect(validateMetricInput({ name: "Headache", valueType: "ENUM", enumOptions: ["NONE"] })).toBe(
      "Enum metrics need at least 2 options."
    );
  });

  it("accepts a valid ENUM metric with 2+ options", () => {
    expect(validateMetricInput({ name: "Headache", valueType: "ENUM", enumOptions: ["NONE", "MILD", "MODERATE", "BAD"] })).toBeNull();
  });
});

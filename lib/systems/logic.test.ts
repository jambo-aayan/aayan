import { describe, expect, it } from "vitest";
import { validateCreateSystemInput, canSetParent, resolveBackdate, isValidRating, isValidMeasureNumber } from "./logic";

describe("validateCreateSystemInput", () => {
  it("rejects a blank name", () => {
    expect(validateCreateSystemInput({ name: "  ", type: "PROCESS", review: null, criteria: null })).toEqual({
      ok: false,
      error: "Give the System a name first.",
    });
  });

  it("accepts a Process with just a name", () => {
    expect(
      validateCreateSystemInput({ name: "Payday routine", type: "PROCESS", review: null, criteria: null })
    ).toEqual({ ok: true });
  });

  it("rejects an Experiment with no review date", () => {
    expect(
      validateCreateSystemInput({
        name: "Elimination diet",
        type: "EXPERIMENT",
        review: null,
        criteria: "Symptoms improve",
      })
    ).toEqual({ ok: false, error: "Experiments need a review date." });
  });

  it("rejects an Experiment with no criteria", () => {
    expect(
      validateCreateSystemInput({
        name: "Elimination diet",
        type: "EXPERIMENT",
        review: new Date("2026-09-01"),
        criteria: "  ",
      })
    ).toEqual({ ok: false, error: "Experiments need success criteria." });
  });

  it("accepts an Experiment with both review date and criteria", () => {
    expect(
      validateCreateSystemInput({
        name: "Elimination diet",
        type: "EXPERIMENT",
        review: new Date("2026-09-01"),
        criteria: "Symptoms improve",
      })
    ).toEqual({ ok: true });
  });
});

describe("canSetParent", () => {
  it("allows setting a parent when the System has no children", () => {
    expect(canSetParent(false)).toBe(true);
  });

  it("rejects setting a parent when the System already has children", () => {
    expect(canSetParent(true)).toBe(false);
  });
});

describe("resolveBackdate", () => {
  const today = new Date("2026-08-27");

  it("accepts a past date", () => {
    const result = resolveBackdate(new Date("2026-08-20"), today);
    expect(result.ok).toBe(true);
  });

  it("accepts today", () => {
    const result = resolveBackdate(new Date("2026-08-27"), today);
    expect(result.ok).toBe(true);
  });

  it("rejects a future date", () => {
    expect(resolveBackdate(new Date("2026-08-28"), today)).toEqual({
      ok: false,
      error: "That date hasn't happened yet.",
    });
  });
});

describe("isValidRating", () => {
  it("accepts 1 through 5", () => {
    expect([1, 2, 3, 4, 5].every(isValidRating)).toBe(true);
  });

  it("rejects out-of-range and non-integer values", () => {
    expect(isValidRating(0)).toBe(false);
    expect(isValidRating(6)).toBe(false);
    expect(isValidRating(3.5)).toBe(false);
  });
});

describe("isValidMeasureNumber", () => {
  it("accepts finite numbers, including decimals and negatives", () => {
    expect(isValidMeasureNumber(78.4)).toBe(true);
    expect(isValidMeasureNumber(-5)).toBe(true);
    expect(isValidMeasureNumber(0)).toBe(true);
  });

  it("rejects NaN and Infinity", () => {
    expect(isValidMeasureNumber(NaN)).toBe(false);
    expect(isValidMeasureNumber(Infinity)).toBe(false);
  });
});

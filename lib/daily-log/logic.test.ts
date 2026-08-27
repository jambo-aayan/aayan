import { describe, expect, it } from "vitest";
import {
  STIFFNESS_MIDPOINT,
  stiffnessMidpoint,
  stiffnessBucketFromMidpoint,
  applyHeadacheTap,
  validateDailyLogInput,
  type DailyLogInput,
} from "./logic";

function validInput(overrides: Partial<DailyLogInput> = {}): DailyLogInput {
  return {
    mood: 3,
    stress: 3,
    energy: 3,
    sleepQuality: 3,
    pain: 2,
    headache: "NONE",
    stiffnessBucket: "UNDER_15",
    weight: null,
    waist: null,
    bpSystolic: null,
    bpDiastolic: null,
    ...overrides,
  };
}

describe("stiffnessMidpoint", () => {
  it("maps each bucket to its representative midpoint", () => {
    expect(stiffnessMidpoint("UNDER_15")).toBe(7);
    expect(stiffnessMidpoint("15_TO_30")).toBe(22);
    expect(stiffnessMidpoint("30_TO_60")).toBe(45);
    expect(stiffnessMidpoint("OVER_60")).toBe(75);
  });
});

describe("stiffnessBucketFromMidpoint", () => {
  it("is the exact inverse of stiffnessMidpoint for every bucket", () => {
    for (const bucket of Object.keys(STIFFNESS_MIDPOINT) as (keyof typeof STIFFNESS_MIDPOINT)[]) {
      expect(stiffnessBucketFromMidpoint(stiffnessMidpoint(bucket))).toBe(bucket);
    }
  });

  it("returns null for a value that isn't one of the four stored midpoints", () => {
    expect(stiffnessBucketFromMidpoint(30)).toBeNull();
  });
});

describe("applyHeadacheTap", () => {
  it("accepts a tap that raises the severity", () => {
    expect(applyHeadacheTap("NONE", "MILD")).toBe("MILD");
    expect(applyHeadacheTap("MILD", "MODERATE")).toBe("MODERATE");
    expect(applyHeadacheTap("MODERATE", "BAD")).toBe("BAD");
    expect(applyHeadacheTap("NONE", "BAD")).toBe("BAD");
  });

  it("silently keeps the current (higher) value on a tap that would lower it", () => {
    expect(applyHeadacheTap("BAD", "MILD")).toBe("BAD");
    expect(applyHeadacheTap("MODERATE", "NONE")).toBe("MODERATE");
    expect(applyHeadacheTap("MILD", "NONE")).toBe("MILD");
  });

  it("is a no-op tapping the same value again", () => {
    expect(applyHeadacheTap("MODERATE", "MODERATE")).toBe("MODERATE");
  });
});

describe("validateDailyLogInput", () => {
  it("accepts a full valid input with every optional field blank", () => {
    expect(validateDailyLogInput(validInput())).toEqual({ ok: true });
  });

  it("accepts a valid input with optional numeric fields filled in", () => {
    const input = validInput({ weight: 78.2, waist: 86, bpSystolic: 120, bpDiastolic: 80 });
    expect(validateDailyLogInput(input)).toEqual({ ok: true });
  });

  it("refuses to save without a stiffness bucket, since the charts read it", () => {
    const result = validateDailyLogInput(validInput({ stiffnessBucket: null }));
    expect(result.ok).toBe(false);
  });

  it("refuses a required 1-5 field outside its range", () => {
    expect(validateDailyLogInput(validInput({ mood: 0 })).ok).toBe(false);
    expect(validateDailyLogInput(validInput({ pain: 6 })).ok).toBe(false);
  });

  it("does not require any of the four optional numeric fields", () => {
    // only bpSystolic set, bpDiastolic still blank — each optional field is
    // independently optional, not an all-or-nothing group.
    const input = validInput({ bpSystolic: 120 });
    expect(validateDailyLogInput(input)).toEqual({ ok: true });
  });
});

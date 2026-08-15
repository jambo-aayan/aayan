import { describe, expect, it } from "vitest";
import { requiredMonthlyRate, verdict, projectedValue } from "./north-star-math";

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe("requiredMonthlyRate", () => {
  it("is the shortfall divided by whole months remaining to the deadline", () => {
    // £45,000 target - £18,400 current = £26,600 over 12 months = £2,216.67/mo
    const rate = requiredMonthlyRate(18400, 45000, d("2027-08-01"), d("2026-08-01"));
    expect(rate).toBeCloseTo(2216.67, 2);
  });

  it("is 0 when the target is already met", () => {
    expect(requiredMonthlyRate(50000, 45000, d("2027-08-01"), d("2026-08-01"))).toBe(0);
  });

  it("treats a deadline in the past (or this month) as needing the full shortfall now", () => {
    expect(requiredMonthlyRate(18400, 45000, d("2026-08-01"), d("2026-08-01"))).toBe(26600);
  });
});

describe("verdict", () => {
  it("is ON_TRACK when the actual rate meets or exceeds the required rate", () => {
    expect(verdict(2300, 2216.67)).toBe("ON_TRACK");
    expect(verdict(2216.67, 2216.67)).toBe("ON_TRACK");
  });

  it("is BEHIND when the actual rate falls short", () => {
    expect(verdict(1500, 2216.67)).toBe("BEHIND");
  });

  it("is ON_TRACK when there's no requirement left (target already met)", () => {
    expect(verdict(0, 0)).toBe("ON_TRACK");
  });
});

describe("projectedValue", () => {
  it("projects current value forward at the actual monthly rate", () => {
    // £18,400 + £850/mo * 12 * 5 years = £69,400
    expect(projectedValue(18400, 850, 5)).toBe(69400);
  });

  it("doesn't go backward when the monthly rate is negative, just reflects the decline", () => {
    expect(projectedValue(18400, -100, 1)).toBe(17200);
  });
});

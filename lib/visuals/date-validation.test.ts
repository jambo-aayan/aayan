import { describe, expect, it } from "vitest";
import { isValidIsoDateString } from "./date-validation";

describe("isValidIsoDateString", () => {
  it("accepts a real calendar date", () => {
    expect(isValidIsoDateString("2026-01-15")).toBe(true);
    expect(isValidIsoDateString("2024-02-29")).toBe(true); // leap year
  });

  it("rejects the wrong shape entirely", () => {
    expect(isValidIsoDateString("15/01/2026")).toBe(false);
    expect(isValidIsoDateString("2026-1-15")).toBe(false);
    expect(isValidIsoDateString("not a date")).toBe(false);
    expect(isValidIsoDateString("")).toBe(false);
  });

  it("rejects a day that rolls over into the next month instead of erroring", () => {
    expect(isValidIsoDateString("2026-02-30")).toBe(false);
    expect(isValidIsoDateString("2023-02-29")).toBe(false); // not a leap year
  });

  it("rejects an out-of-range month", () => {
    expect(isValidIsoDateString("2026-13-01")).toBe(false);
    expect(isValidIsoDateString("2026-00-01")).toBe(false);
  });
});

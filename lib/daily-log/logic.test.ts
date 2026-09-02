import { describe, expect, it } from "vitest";
import { STIFFNESS_MIDPOINT, stiffnessBucketFromMidpoint } from "./logic";

describe("stiffnessBucketFromMidpoint", () => {
  it("is the exact inverse of STIFFNESS_MIDPOINT for every bucket", () => {
    for (const [bucket, midpoint] of Object.entries(STIFFNESS_MIDPOINT) as [keyof typeof STIFFNESS_MIDPOINT, number][]) {
      expect(stiffnessBucketFromMidpoint(midpoint)).toBe(bucket);
    }
  });

  it("returns null for a value that isn't one of the four stored midpoints", () => {
    expect(stiffnessBucketFromMidpoint(30)).toBeNull();
  });
});

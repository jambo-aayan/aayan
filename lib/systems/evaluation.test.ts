import { describe, expect, it } from "vitest";
import { evaluationScore } from "./evaluation";

describe("evaluationScore", () => {
  it("averages the three dimensions", () => {
    expect(evaluationScore({ effectiveness: 4, consistency: 3, sustainability: 5 })).toBeCloseTo(4, 5);
  });

  it("keeps fractional averages rather than rounding", () => {
    expect(evaluationScore({ effectiveness: 5, consistency: 4, sustainability: 4 })).toBeCloseTo(13 / 3, 5);
  });

  it("handles the all-1s and all-5s extremes", () => {
    expect(evaluationScore({ effectiveness: 1, consistency: 1, sustainability: 1 })).toBe(1);
    expect(evaluationScore({ effectiveness: 5, consistency: 5, sustainability: 5 })).toBe(5);
  });

  it("surfaces divergence between dimensions rather than hiding it — same score can come from very different inputs", () => {
    // The averaging itself doesn't hide divergence (that's the caller's
    // job, showing all three dimensions alongside the score) — this just
    // documents that two very different-looking entries can share a score.
    expect(evaluationScore({ effectiveness: 5, consistency: 3, sustainability: 1 })).toBeCloseTo(3, 5);
    expect(evaluationScore({ effectiveness: 3, consistency: 3, sustainability: 3 })).toBeCloseTo(3, 5);
  });
});

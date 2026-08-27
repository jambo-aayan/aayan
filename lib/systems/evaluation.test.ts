import { describe, expect, it } from "vitest";
import { evaluationScore, isEvaluationStale, needsAttention, type EvaluationFixture } from "./evaluation";

function d(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

function entry(date: string, effectiveness: number, consistency: number, sustainability: number): EvaluationFixture {
  return { date: d(date), effectiveness, consistency, sustainability, note: null };
}

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

describe("isEvaluationStale", () => {
  it("is stale when there's never been an entry", () => {
    expect(isEvaluationStale(null, d("2026-08-27"))).toBe(true);
  });

  it("is not stale at 29 days since the last entry", () => {
    expect(isEvaluationStale(d("2026-07-29"), d("2026-08-27"))).toBe(false);
  });

  it("is stale exactly at the 30-day threshold", () => {
    expect(isEvaluationStale(d("2026-07-28"), d("2026-08-27"))).toBe(true);
  });

  it("is stale at 31 days since the last entry", () => {
    expect(isEvaluationStale(d("2026-07-27"), d("2026-08-27"))).toBe(true);
  });

  it("is not stale for an entry logged today", () => {
    expect(isEvaluationStale(d("2026-08-27"), d("2026-08-27"))).toBe(false);
  });
});

describe("needsAttention", () => {
  it("returns null when no System has any entries", () => {
    expect(needsAttention([{ id: "s1", name: "Sleep routine", entries: [] }])).toBeNull();
  });

  it("surfaces the lowest recent score when nothing is declining", () => {
    const result = needsAttention([
      { id: "s1", name: "Cold showers", entries: [entry("2026-08-01", 4, 4, 4)] },
      { id: "s2", name: "Journaling", entries: [entry("2026-08-01", 2, 2, 2)] },
    ]);
    expect(result).toEqual({ systemId: "s2", systemName: "Journaling", score: 2, reason: "low-score" });
  });

  it("prioritizes a sharp decline over a merely-low-but-flat score", () => {
    const result = needsAttention([
      // Low but flat — never actually declined.
      { id: "s1", name: "Cold showers", entries: [entry("2026-08-08", 2, 2, 2), entry("2026-08-01", 2, 2, 2)] },
      // Higher score overall, but one dimension just dropped sharply.
      { id: "s2", name: "Journaling", entries: [entry("2026-08-08", 4, 4, 1), entry("2026-08-01", 4, 4, 5)] },
    ]);
    expect(result).toEqual({ systemId: "s2", systemName: "Journaling", score: 3, reason: "declining-trend" });
  });

  it("requires at least a 1-point drop in some dimension to count as declining", () => {
    const result = needsAttention([{ id: "s1", name: "Cold showers", entries: [entry("2026-08-08", 3, 3, 3), entry("2026-08-01", 3.5, 3, 3)] }]);
    expect(result?.reason).toBe("low-score");
  });

  it("sorts entries defensively even when the caller passes them oldest-first", () => {
    const result = needsAttention([
      { id: "s1", name: "Cold showers", entries: [entry("2026-08-01", 4, 4, 5), entry("2026-08-08", 4, 4, 1)] },
    ]);
    expect(result).toEqual({ systemId: "s1", systemName: "Cold showers", score: 3, reason: "declining-trend" });
  });

  it("breaks a tie between equally-low scores by keeping the first found", () => {
    const result = needsAttention([
      { id: "s1", name: "Cold showers", entries: [entry("2026-08-01", 2, 2, 2)] },
      { id: "s2", name: "Journaling", entries: [entry("2026-08-01", 2, 2, 2)] },
    ]);
    expect(result?.systemId).toBe("s1");
  });

  it("works with a single System and a single entry", () => {
    const result = needsAttention([{ id: "s1", name: "Cold showers", entries: [entry("2026-08-01", 3, 3, 3)] }]);
    expect(result).toEqual({ systemId: "s1", systemName: "Cold showers", score: 3, reason: "low-score" });
  });
});

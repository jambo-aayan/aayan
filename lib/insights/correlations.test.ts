import { describe, expect, it } from "vitest";
import {
  pearsonCorrelation,
  correlationStrength,
  correlationClaim,
  computeCorrelation,
  computeCorrelations,
  CORRELATION_CAVEAT,
  type CorrelationPair,
} from "./correlations";

describe("pearsonCorrelation", () => {
  it("returns 1 for a perfect positive linear relationship", () => {
    expect(pearsonCorrelation([1, 2, 3, 4], [2, 4, 6, 8])).toBeCloseTo(1, 5);
  });

  it("returns -1 for a perfect inverse relationship", () => {
    expect(pearsonCorrelation([1, 2, 3, 4], [8, 6, 4, 2])).toBeCloseTo(-1, 5);
  });

  it("returns null for mismatched lengths or fewer than 2 points", () => {
    expect(pearsonCorrelation([1, 2], [1])).toBeNull();
    expect(pearsonCorrelation([1], [1])).toBeNull();
    expect(pearsonCorrelation([], [])).toBeNull();
  });

  it("returns null when a series has zero variance", () => {
    expect(pearsonCorrelation([5, 5, 5, 5], [1, 2, 3, 4])).toBeNull();
  });
});

describe("correlationStrength", () => {
  it("buckets by magnitude at the handoff's exact thresholds", () => {
    expect(correlationStrength(0.6)).toBe("strong");
    expect(correlationStrength(-0.6)).toBe("strong");
    expect(correlationStrength(0.35)).toBe("moderate");
    expect(correlationStrength(0.34)).toBe("weak");
    expect(correlationStrength(0)).toBe("weak");
  });
});

describe("correlationClaim", () => {
  it("names strength and direction in plain language", () => {
    expect(correlationClaim("Habit adherence", "Task follow-through", 0.7, "strong")).toBe(
      "Strong positive relationship between Habit adherence and Task follow-through."
    );
    expect(correlationClaim("Pain", "Adherence", -0.4, "moderate")).toBe(
      "Moderate inverse relationship between Pain and Adherence."
    );
  });
});

describe("computeCorrelation", () => {
  const seriesA = Array.from({ length: 5 }, (_, i) => i);
  const seriesB = Array.from({ length: 5 }, (_, i) => i * 2);

  it("computes r, n, strength, claim, and scatter points for n >= 5", () => {
    const pair: CorrelationPair = { id: "p1", labelA: "A", labelB: "B", seriesA, seriesB };
    const result = computeCorrelation(pair);
    expect(result).not.toBeNull();
    expect(result!.n).toBe(5);
    expect(result!.r).toBe(1);
    expect(result!.strength).toBe("strong");
    expect(result!.points).toHaveLength(5);
  });

  it("suppresses entirely (returns null) below n=5, rather than showing a Weak card", () => {
    const pair: CorrelationPair = { id: "p1", labelA: "A", labelB: "B", seriesA: seriesA.slice(0, 4), seriesB: seriesB.slice(0, 4) };
    expect(computeCorrelation(pair)).toBeNull();
  });

  it("is gated on total n (5), not the old n=14 threshold", () => {
    const fourteenPointPair: CorrelationPair = {
      id: "p2",
      labelA: "A",
      labelB: "B",
      seriesA: Array.from({ length: 4 }, (_, i) => i),
      seriesB: Array.from({ length: 4 }, (_, i) => i * 2),
    };
    // 4 points used to be suppressed only because it's below the old n=14
    // gate; it's still correctly suppressed under n=5 (4 < 5), but for the
    // right reason — this pins the gate at 5, not any other lingering value.
    expect(computeCorrelation(fourteenPointPair)).toBeNull();
  });
});

describe("computeCorrelations", () => {
  it("filters out suppressed pairs from the result list", () => {
    const strongPair: CorrelationPair = {
      id: "strong",
      labelA: "A",
      labelB: "B",
      seriesA: Array.from({ length: 5 }, (_, i) => i),
      seriesB: Array.from({ length: 5 }, (_, i) => i * 2),
    };
    const thinPair: CorrelationPair = { id: "thin", labelA: "C", labelB: "D", seriesA: [1, 2, 3], seriesB: [1, 2, 3] };
    const results = computeCorrelations([strongPair, thinPair]);
    expect(results.map((r) => r.id)).toEqual(["strong"]);
  });
});

describe("CORRELATION_CAVEAT", () => {
  it("matches the prototype's wording verbatim", () => {
    expect(CORRELATION_CAVEAT).toBe(
      "Correlation is not cause, and N observations is thin. Treat this as a hypothesis worth two more weeks of deliberate logging, not a conclusion."
    );
  });
});

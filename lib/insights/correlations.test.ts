import { describe, expect, it } from "vitest";
import {
  pearsonCorrelation,
  correlationStrength,
  correlationClaim,
  computeCorrelation,
  computeCorrelations,
  CORRELATION_CAVEAT,
  generateMetricCorrelationPairs,
  capCorrelationsByMagnitude,
  type CorrelationPair,
  type CorrelationResult,
  type MetricSeriesFixture,
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

describe("generateMetricCorrelationPairs", () => {
  it("pairs every unordered combination of metrics, sharing only same-day entries", () => {
    const metrics: MetricSeriesFixture[] = [
      {
        id: "m1",
        name: "Sleep quality",
        entries: [
          { date: "2026-08-01", value: 3 },
          { date: "2026-08-02", value: 4 },
        ],
      },
      {
        id: "m2",
        name: "Stiffness",
        entries: [
          { date: "2026-08-01", value: 5 },
          { date: "2026-08-03", value: 2 }, // no matching day on m1 — excluded
        ],
      },
    ];
    const pairs = generateMetricCorrelationPairs(metrics);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]).toMatchObject({ id: "metric:m1:m2", labelA: "Sleep quality", labelB: "Stiffness", seriesA: [3], seriesB: [5], dates: ["2026-08-01"] });
  });

  it("produces one pair per combination for 3+ metrics, not permutations", () => {
    const metrics: MetricSeriesFixture[] = [
      { id: "a", name: "A", entries: [{ date: "d1", value: 1 }] },
      { id: "b", name: "B", entries: [{ date: "d1", value: 2 }] },
      { id: "c", name: "C", entries: [{ date: "d1", value: 3 }] },
    ];
    const pairs = generateMetricCorrelationPairs(metrics);
    expect(pairs.map((p) => p.id).sort()).toEqual(["metric:a:b", "metric:a:c", "metric:b:c"]);
  });

  it("omits a pair with no shared days at all", () => {
    const metrics: MetricSeriesFixture[] = [
      { id: "a", name: "A", entries: [{ date: "d1", value: 1 }] },
      { id: "b", name: "B", entries: [{ date: "d2", value: 2 }] },
    ];
    expect(generateMetricCorrelationPairs(metrics)).toEqual([]);
  });

  it("returns no pairs for fewer than two metrics", () => {
    expect(generateMetricCorrelationPairs([])).toEqual([]);
    expect(generateMetricCorrelationPairs([{ id: "a", name: "A", entries: [] }])).toEqual([]);
  });
});

describe("capCorrelationsByMagnitude", () => {
  function result(id: string, r: number): CorrelationResult {
    return { id, labelA: "A", labelB: "B", r, n: 5, strength: correlationStrength(r), claim: "", points: [] };
  }

  it("keeps only the top N results by |r|, strongest first", () => {
    const results = [result("weak", 0.1), result("strong-neg", -0.9), result("moderate", 0.4)];
    expect(capCorrelationsByMagnitude(results, 2).map((r) => r.id)).toEqual(["strong-neg", "moderate"]);
  });

  it("does not drop anything when under the cap", () => {
    const results = [result("a", 0.2), result("b", -0.3)];
    expect(capCorrelationsByMagnitude(results, 8)).toHaveLength(2);
  });
});

describe("CORRELATION_CAVEAT", () => {
  it("matches the prototype's wording verbatim", () => {
    expect(CORRELATION_CAVEAT).toBe(
      "Correlation is not cause, and N observations is thin. Treat this as a hypothesis worth two more weeks of deliberate logging, not a conclusion."
    );
  });
});

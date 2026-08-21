import { describe, expect, it } from "vitest";
import { computeWeeklyDigest, type DeltaFixture, type CorrelationFixture, type HabitAdherenceFixture } from "./weekly-digest";

describe("computeWeeklyDigest — Worked", () => {
  it("takes the top 2 positive deltas, most positive first", () => {
    const deltas: DeltaFixture[] = [
      { label: "Adherence", delta: 5 },
      { label: "Surplus", delta: 20 },
      { label: "Follow-through", delta: -3 },
    ];
    const digest = computeWeeklyDigest(deltas, [], []);
    expect(digest.worked).toEqual(["Surplus is up 20 points this week.", "Adherence is up 5 points this week."]);
  });

  it("returns fewer than 2 sentences when there aren't enough positive deltas", () => {
    const digest = computeWeeklyDigest([{ label: "Adherence", delta: 5 }], [], []);
    expect(digest.worked).toEqual(["Adherence is up 5 points this week."]);
  });

  it("returns an empty list when nothing improved", () => {
    const digest = computeWeeklyDigest([{ label: "Adherence", delta: -5 }], [], []);
    expect(digest.worked).toEqual([]);
  });
});

describe("computeWeeklyDigest — Slipped", () => {
  it("takes the top 2 negative deltas, most negative first", () => {
    const deltas: DeltaFixture[] = [
      { label: "Adherence", delta: -5 },
      { label: "Surplus", delta: -20 },
      { label: "Follow-through", delta: 3 },
    ];
    const digest = computeWeeklyDigest(deltas, [], []);
    expect(digest.slipped).toEqual(["Surplus is down 20 points this week.", "Adherence is down 5 points this week."]);
  });
});

describe("computeWeeklyDigest — Surprising", () => {
  it("names the strongest correlation that contradicts its expected sign", () => {
    const correlations: CorrelationFixture[] = [
      { labelA: "Adherence", labelB: "Pain", r: 0.5, expectedSign: -1 }, // expected negative, got positive -> contradicts
      { labelA: "Adherence", labelB: "Surplus", r: 0.4, expectedSign: 1 }, // matches expectation -> not surprising
    ];
    const digest = computeWeeklyDigest([], correlations, []);
    expect(digest.surprising).toContain("Adherence and Pain moved opposite to what you'd expect");
  });

  it("ignores a contradicting correlation below the strength threshold", () => {
    const correlations: CorrelationFixture[] = [{ labelA: "A", labelB: "B", r: 0.2, expectedSign: -1 }];
    const deltas: DeltaFixture[] = [{ label: "Adherence", delta: 10 }];
    const digest = computeWeeklyDigest(deltas, correlations, []);
    expect(digest.surprising).toContain("Adherence moved the most");
  });

  it("falls back to the largest-magnitude delta when nothing contradicts expectations", () => {
    const deltas: DeltaFixture[] = [
      { label: "Adherence", delta: 3 },
      { label: "Surplus", delta: -15 },
    ];
    const digest = computeWeeklyDigest(deltas, [], []);
    expect(digest.surprising).toBe("Surplus moved the most this week, down 15 points.");
  });

  it("reports nothing stood out when there's no data at all", () => {
    const digest = computeWeeklyDigest([], [], []);
    expect(digest.surprising).toBe("Nothing stood out this week.");
  });
});

describe("computeWeeklyDigest — One thing", () => {
  it("anchors the worst-adhered habit to the best-adhered one", () => {
    const habitAdherence: HabitAdherenceFixture[] = [
      { name: "Journal", pct: 20 },
      { name: "Stretch", pct: 90 },
      { name: "Read", pct: 60 },
    ];
    const digest = computeWeeklyDigest([], [], habitAdherence);
    expect(digest.oneThing).toBe("Anchor Journal to Stretch — do them back-to-back so one reminds you of the other.");
  });

  it("falls back to a generic prompt with fewer than 2 habits", () => {
    const digest = computeWeeklyDigest([], [], [{ name: "Stretch", pct: 90 }]);
    expect(digest.oneThing).toContain("not enough data yet");
  });

  it("falls back to a generic prompt when every habit has identical adherence", () => {
    const habitAdherence: HabitAdherenceFixture[] = [
      { name: "A", pct: 50 },
      { name: "B", pct: 50 },
    ];
    expect(computeWeeklyDigest([], [], habitAdherence).oneThing).toContain("not enough data yet");
  });
});

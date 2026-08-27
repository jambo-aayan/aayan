import { describe, expect, it } from "vitest";
import { ratingTrend, ratingHistogram, type RatedStep } from "./widgets";

function step(rating: number | null, doneOn: string | null): RatedStep {
  return { rating, doneOn: doneOn ? new Date(doneOn) : null };
}

describe("ratingTrend", () => {
  it("returns null below 2 ratings", () => {
    expect(ratingTrend([step(3, "2026-08-01")])).toBeNull();
  });

  it("ignores steps with no rating or no completion date", () => {
    expect(ratingTrend([step(null, "2026-08-01"), step(3, null), step(4, "2026-08-02")])).toBeNull();
  });

  it("returns sorted points once 2+ ratings exist", () => {
    const result = ratingTrend([step(4, "2026-08-02"), step(3, "2026-08-01")]);
    expect(result).toEqual([
      { date: new Date("2026-08-01"), rating: 3 },
      { date: new Date("2026-08-02"), rating: 4 },
    ]);
  });
});

describe("ratingHistogram", () => {
  it("returns null below 5 ratings", () => {
    const steps = [step(3, "2026-08-01"), step(4, "2026-08-02"), step(5, "2026-08-03"), step(3, "2026-08-04")];
    expect(ratingHistogram(steps)).toBeNull();
  });

  it("returns mean/spread/counts once 5+ ratings exist", () => {
    const steps = [3, 3, 3, 3, 5].map((r, i) => step(r, `2026-08-0${i + 1}`));
    const result = ratingHistogram(steps);
    expect(result).not.toBeNull();
    expect(result!.mean).toBeCloseTo(3.4);
    expect(result!.counts).toEqual({ 3: 4, 5: 1 });
    expect(result!.spread).toBeGreaterThan(0);
  });
});

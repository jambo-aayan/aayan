import { describe, expect, it } from "vitest";
import {
  ratingTrend,
  ratingHistogram,
  milestoneList,
  isGanttEligible,
  kanbanColumn,
  numericTrend,
  targetGauge,
  distinctMetricNames,
  type RatedStep,
  type MilestoneStep,
  type MeasureStep,
} from "./widgets";

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

function milestone(text: string, date: string | null, done = false): MilestoneStep {
  return { text, date: date ? new Date(date) : null, done };
}

describe("milestoneList", () => {
  it("returns null when there are no dated milestones", () => {
    expect(milestoneList([milestone("Undated", null)])).toBeNull();
  });

  it("returns dated milestones, excluding undated ones", () => {
    const result = milestoneList([milestone("Undated", null), milestone("Launch", "2026-09-01")]);
    expect(result).toEqual([milestone("Launch", "2026-09-01")]);
  });
});

describe("isGanttEligible", () => {
  it("is false below 3 dated milestones", () => {
    expect(isGanttEligible([milestone("A", "2026-09-01"), milestone("B", "2026-09-02")])).toBe(false);
  });

  it("is true at 3+ dated milestones", () => {
    expect(
      isGanttEligible([milestone("A", "2026-09-01"), milestone("B", "2026-09-02"), milestone("C", "2026-09-03")])
    ).toBe(true);
  });
});

describe("kanbanColumn", () => {
  const today = new Date("2026-09-05");

  it("is DONE when the milestone is done, regardless of date", () => {
    expect(kanbanColumn(milestone("Done", "2026-09-10", true), today)).toBe("DONE");
  });

  it("is IN_PROGRESS once the date has arrived and it's not done", () => {
    expect(kanbanColumn(milestone("Due", "2026-09-01"), today)).toBe("IN_PROGRESS");
  });

  it("is NOT_STARTED while the date is still in the future", () => {
    expect(kanbanColumn(milestone("Later", "2026-09-10"), today)).toBe("NOT_STARTED");
  });
});

function measure(metricName: string | null, value: number | null, target: number | null, doneOn: string | null): MeasureStep {
  return { metricName, value, target, doneOn: doneOn ? new Date(doneOn) : null };
}

describe("numericTrend", () => {
  it("returns null below 2 readings of the metric", () => {
    expect(numericTrend([measure("Weight", 80, null, "2026-08-01")], "Weight")).toBeNull();
  });

  it("ignores other metrics and returns sorted readings once 2+ exist", () => {
    const steps = [
      measure("Weight", 79, null, "2026-08-02"),
      measure("Weight", 80, null, "2026-08-01"),
      measure("Waist", 85, null, "2026-08-01"),
    ];
    expect(numericTrend(steps, "Weight")).toEqual([
      { date: new Date("2026-08-01"), value: 80 },
      { date: new Date("2026-08-02"), value: 79 },
    ]);
  });
});

describe("targetGauge", () => {
  it("returns null when no reading of the metric has a target", () => {
    const steps = [measure("Weight", 80, null, "2026-08-01")];
    expect(targetGauge(steps, "Weight")).toBeNull();
  });

  it("returns start/current/target once a target exists", () => {
    const steps = [
      measure("Weight", 80, 75, "2026-08-01"),
      measure("Weight", 78, null, "2026-08-05"),
    ];
    expect(targetGauge(steps, "Weight")).toEqual({ start: 80, current: 78, target: 75 });
  });
});

describe("distinctMetricNames", () => {
  it("returns null below 2 distinct metrics", () => {
    expect(distinctMetricNames([measure("Weight", 80, null, "2026-08-01")])).toBeNull();
  });

  it("returns distinct metric names once 2+ exist", () => {
    const steps = [measure("Weight", 80, null, "2026-08-01"), measure("Waist", 85, null, "2026-08-01")];
    expect(distinctMetricNames(steps)).toEqual(["Weight", "Waist"]);
  });
});

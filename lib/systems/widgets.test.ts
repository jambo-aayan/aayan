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
  streakGrid,
  adherenceBreakdown,
  ratingVsAdherence,
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

describe("streakGrid", () => {
  it("marks each of the last N days done/not against logged occurrences", () => {
    const today = new Date("2026-08-10");
    const grid = streakGrid([new Date("2026-08-09"), new Date("2026-08-10")], today, 3);
    expect(grid.map((d) => d.done)).toEqual([false, true, true]);
    expect(grid[0].date).toEqual(new Date("2026-08-08"));
    expect(grid[2].date).toEqual(new Date("2026-08-10"));
  });

  it("still matches when `today` is full-precision (e.g. `new Date()`) against midnight-stored occurrences", () => {
    const today = new Date("2026-08-10T16:45:00.000Z");
    const grid = streakGrid([new Date("2026-08-10")], today, 1);
    expect(grid[0].done).toBe(true);
  });
});

describe("adherenceBreakdown", () => {
  it("returns null below 3 logged occurrences", () => {
    expect(adherenceBreakdown(["ON_TIME", "LATE"], 2)).toBeNull();
  });

  it("returns counts once 3+ occurrences are logged", () => {
    const result = adherenceBreakdown(["ON_TIME", "ON_TIME", "LATE", "SKIPPED"], 3);
    expect(result).toEqual({ onTime: 2, late: 1, skipped: 1 });
  });
});

describe("ratingVsAdherence", () => {
  it("returns null below 5 ratings", () => {
    const steps = [step(3, "2026-08-01"), step(4, "2026-08-02"), step(5, "2026-08-03"), step(3, "2026-08-04")];
    expect(ratingVsAdherence(steps, [])).toBeNull();
  });

  it("returns split-mean's not-ready result when the habit side lacks enough data", () => {
    const steps = [3, 4, 5, 3, 4].map((r, i) => step(r, `2026-08-0${i + 1}`));
    const result = ratingVsAdherence(steps, [new Date("2026-08-01")]);
    expect(result).not.toBeNull();
    expect(result!.ready).toBe(false);
  });

  it("returns a ready comparison once both sides have 3+ days", () => {
    const steps = [3, 4, 5, 3, 4, 5].map((r, i) => step(r, `2026-08-0${i + 1}`));
    const habitDates = [new Date("2026-08-01"), new Date("2026-08-02"), new Date("2026-08-03")];
    const result = ratingVsAdherence(steps, habitDates);
    expect(result).not.toBeNull();
    expect(result!.ready).toBe(true);
  });
});

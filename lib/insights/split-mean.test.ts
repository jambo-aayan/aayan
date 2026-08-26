import { describe, expect, it } from "vitest";
import { splitMean } from "./split-mean";

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

const log = (iso: string, value: number) => ({ date: d(iso), value });

describe("splitMean — not enough data", () => {
  it("is not ready with zero logs", () => {
    expect(splitMean([], [])).toEqual({ ready: false, sampleSize: 0 });
  });

  it("is not ready with fewer than 3 predicate-true days, even with plenty of false days", () => {
    const logs = [
      log("2026-08-01", 5),
      log("2026-08-02", 4),
      log("2026-08-03", 6),
      log("2026-08-04", 5),
      log("2026-08-05", 3),
      log("2026-08-06", 4),
    ];
    const trueDates = [d("2026-08-01"), d("2026-08-02")]; // only 2 true days
    const result = splitMean(logs, trueDates);
    expect(result.ready).toBe(false);
  });

  it("is not ready with fewer than 3 predicate-false days", () => {
    const logs = [log("2026-08-01", 5), log("2026-08-02", 4), log("2026-08-03", 6), log("2026-08-04", 5)];
    // all 4 logged days are predicate-true, 0 false days
    const trueDates = logs.map((l) => l.date);
    const result = splitMean(logs, trueDates);
    expect(result.ready).toBe(false);
  });

  it("is exactly at the boundary (3 and 3) and IS ready", () => {
    const logs = [
      log("2026-08-01", 6),
      log("2026-08-02", 7),
      log("2026-08-03", 8),
      log("2026-08-04", 2),
      log("2026-08-05", 3),
      log("2026-08-06", 4),
    ];
    const trueDates = [d("2026-08-01"), d("2026-08-02"), d("2026-08-03")]; // exactly 3 true
    const result = splitMean(logs, trueDates);
    expect(result.ready).toBe(true);
  });
});

describe("splitMean — ready, pain-vs-habit-checkin (the original case)", () => {
  it("computes average pain on habit-done vs habit-not-done days", () => {
    const logs = [
      log("2026-08-01", 6),
      log("2026-08-02", 8),
      log("2026-08-03", 7), // done days: avg 7
      log("2026-08-04", 2),
      log("2026-08-05", 3),
      log("2026-08-06", 4), // not-done days: avg 3
    ];
    const trueDates = [d("2026-08-01"), d("2026-08-02"), d("2026-08-03")];
    const result = splitMean(logs, trueDates);
    expect(result).toEqual({ ready: true, trueAvg: 7, falseAvg: 3, trueDays: 3, falseDays: 3 });
  });
});

describe("splitMean — ready, a non-pain paired series", () => {
  it("computes average stiffness (0-100 scale) on trained vs. not-trained days — proving this isn't pain-specific anymore", () => {
    const logs = [
      log("2026-08-01", 20), // trained days: low stiffness
      log("2026-08-02", 15),
      log("2026-08-03", 25),
      log("2026-08-04", 60), // not-trained days: high stiffness
      log("2026-08-05", 55),
      log("2026-08-06", 70),
    ];
    const trainedDates = [d("2026-08-01"), d("2026-08-02"), d("2026-08-03")];
    const result = splitMean(logs, trainedDates);
    expect(result).toEqual({ ready: true, trueAvg: 20, falseAvg: 61.666666666666664, trueDays: 3, falseDays: 3 });
  });
});

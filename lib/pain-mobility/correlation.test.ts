import { describe, expect, it } from "vitest";
import { correlate } from "./correlation";

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

const painLog = (iso: string, pain: number) => ({ date: d(iso), pain });

describe("correlate — not enough data", () => {
  it("is not ready with zero logs", () => {
    expect(correlate([], [])).toEqual({ ready: false, sampleSize: 0 });
  });

  it("is not ready with fewer than 3 habit-done days, even with plenty of not-done days", () => {
    const logs = [
      painLog("2026-08-01", 5),
      painLog("2026-08-02", 4),
      painLog("2026-08-03", 6),
      painLog("2026-08-04", 5),
      painLog("2026-08-05", 3),
      painLog("2026-08-06", 4),
    ];
    const habitDates = [d("2026-08-01"), d("2026-08-02")]; // only 2 done days
    const result = correlate(logs, habitDates);
    expect(result.ready).toBe(false);
  });

  it("is not ready with fewer than 3 habit-not-done days", () => {
    const logs = [
      painLog("2026-08-01", 5),
      painLog("2026-08-02", 4),
      painLog("2026-08-03", 6),
      painLog("2026-08-04", 5),
    ];
    // all 4 logged days are habit-done, 0 not-done days
    const habitDates = logs.map((l) => l.date);
    const result = correlate(logs, habitDates);
    expect(result.ready).toBe(false);
  });

  it("is exactly at the boundary (3 and 3) and IS ready", () => {
    const logs = [
      painLog("2026-08-01", 6),
      painLog("2026-08-02", 7),
      painLog("2026-08-03", 8),
      painLog("2026-08-04", 2),
      painLog("2026-08-05", 3),
      painLog("2026-08-06", 4),
    ];
    const habitDates = [d("2026-08-01"), d("2026-08-02"), d("2026-08-03")]; // exactly 3 done
    const result = correlate(logs, habitDates);
    expect(result.ready).toBe(true);
  });
});

describe("correlate — ready", () => {
  it("computes average pain on habit-done vs habit-not-done days", () => {
    const logs = [
      painLog("2026-08-01", 6),
      painLog("2026-08-02", 8),
      painLog("2026-08-03", 7), // done days: avg 7
      painLog("2026-08-04", 2),
      painLog("2026-08-05", 3),
      painLog("2026-08-06", 4), // not-done days: avg 3
    ];
    const habitDates = [d("2026-08-01"), d("2026-08-02"), d("2026-08-03")];
    const result = correlate(logs, habitDates);
    expect(result).toEqual({
      ready: true,
      habitDoneAvgPain: 7,
      habitNotDoneAvgPain: 3,
      habitDoneDays: 3,
      habitNotDoneDays: 3,
    });
  });
});

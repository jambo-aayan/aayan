import { describe, expect, it } from "vitest";
import { weeklyAverage, weekTrend } from "./trend";

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe("weeklyAverage", () => {
  it("averages values whose date falls in the given week", () => {
    // Week of Mon 2026-08-10: includes Sat 15th and Sun 16th (same week).
    const logs = [
      { date: d("2026-08-10"), value: 4 },
      { date: d("2026-08-15"), value: 6 },
      { date: d("2026-08-16"), value: 8 },
    ];
    expect(weeklyAverage(logs, d("2026-08-10"))).toBe(6);
  });

  it("excludes values from other weeks", () => {
    const logs = [
      { date: d("2026-08-09"), value: 10 }, // prior week (Sunday)
      { date: d("2026-08-10"), value: 4 },
    ];
    expect(weeklyAverage(logs, d("2026-08-10"))).toBe(4);
  });

  it("is null when no values fall in the given week", () => {
    expect(weeklyAverage([], d("2026-08-10"))).toBeNull();
  });
});

describe("weekTrend", () => {
  it("is UP when the current average exceeds the prior week's", () => {
    expect(weekTrend(7, 5)).toBe("UP");
  });

  it("is DOWN when the current average is below the prior week's", () => {
    expect(weekTrend(3, 5)).toBe("DOWN");
  });

  it("is SAME when the averages are equal", () => {
    expect(weekTrend(5, 5)).toBe("SAME");
  });

  it("is null when either week has no data", () => {
    expect(weekTrend(null, 5)).toBeNull();
    expect(weekTrend(5, null)).toBeNull();
  });
});

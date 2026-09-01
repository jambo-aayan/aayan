import { describe, expect, it } from "vitest";
import { dateValuePoints, latestValue, scatterPoints, heatmapIntensities, valueForDate } from "./records";

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

function record(overrides: Partial<{ date: Date | null; yValue: number | null; xValue: number | null }>) {
  return {
    id: "r1",
    visualId: "v1",
    date: null,
    xValue: null,
    yValue: null,
    xLabel: null,
    note: null,
    createdAt: new Date(),
    ...overrides,
  };
}

describe("dateValuePoints", () => {
  it("returns an empty array for no records", () => {
    expect(dateValuePoints([])).toEqual([]);
  });

  it("sorts by date ascending regardless of input order", () => {
    const records = [
      record({ date: d("2026-01-15"), yValue: 30 }),
      record({ date: d("2026-01-01"), yValue: 10 }),
      record({ date: d("2026-01-10"), yValue: 20 }),
    ];
    expect(dateValuePoints(records).map((p) => p.value)).toEqual([10, 20, 30]);
  });

  it("drops a record missing date or yValue", () => {
    const records = [
      record({ date: d("2026-01-01"), yValue: 10 }),
      record({ date: null, yValue: 20 }),
      record({ date: d("2026-01-02"), yValue: null }),
      record({ xValue: 5, yValue: 40 }),
    ];
    expect(dateValuePoints(records).map((p) => p.value)).toEqual([10]);
  });
});

describe("latestValue", () => {
  it("returns null when there is no data yet", () => {
    expect(latestValue([])).toBeNull();
  });

  it("returns the most recent record's value, not the largest", () => {
    const records = [
      record({ date: d("2026-01-01"), yValue: 999 }),
      record({ date: d("2026-01-10"), yValue: 5 }),
    ];
    expect(latestValue(records)).toBe(5);
  });
});

describe("heatmapIntensities", () => {
  it("returns an empty array for no data", () => {
    expect(heatmapIntensities([])).toEqual([]);
  });

  it("min-max normalizes into a 0-1 range", () => {
    const records = [
      record({ date: d("2026-01-01"), yValue: 0 }),
      record({ date: d("2026-01-02"), yValue: 5 }),
      record({ date: d("2026-01-03"), yValue: 10 }),
    ];
    expect(heatmapIntensities(records).map((c) => c.intensity)).toEqual([0, 0.5, 1]);
  });

  it("shades every point at full intensity when all values are equal (including a single point)", () => {
    expect(heatmapIntensities([record({ date: d("2026-01-01"), yValue: 7 })]).map((c) => c.intensity)).toEqual([1]);
    const records = [record({ date: d("2026-01-01"), yValue: 3 }), record({ date: d("2026-01-02"), yValue: 3 })];
    expect(heatmapIntensities(records).map((c) => c.intensity)).toEqual([1, 1]);
  });
});

describe("scatterPoints", () => {
  it("returns only records with both xValue and yValue set", () => {
    const records = [
      record({ xValue: 1, yValue: 2 }),
      record({ xValue: 3, yValue: null }),
      record({ xValue: null, yValue: 4 }),
      record({ date: d("2026-01-01"), yValue: 5 }),
    ];
    expect(scatterPoints(records)).toEqual([{ x: 1, y: 2 }]);
  });
});

describe("valueForDate", () => {
  it("returns the value of the record matching the given date", () => {
    const records = [record({ date: d("2026-01-01"), yValue: 10 }), record({ date: d("2026-01-02"), yValue: 20 })];
    expect(valueForDate(records, "2026-01-02")).toBe(20);
  });

  it("returns null when no record matches the date", () => {
    const records = [record({ date: d("2026-01-01"), yValue: 10 })];
    expect(valueForDate(records, "2026-01-02")).toBeNull();
  });

  it("returns null for an empty records list", () => {
    expect(valueForDate([], "2026-01-01")).toBeNull();
  });
});

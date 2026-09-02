import { describe, expect, it } from "vitest";
import { metricHistoryPoints } from "./history";

describe("metricHistoryPoints", () => {
  it("maps numeric entries to date-labeled points", () => {
    const points = metricHistoryPoints([
      { date: new Date("2026-08-01"), numberValue: 3, textValue: null },
      { date: new Date("2026-08-02"), numberValue: 4, textValue: null },
    ]);
    expect(points).toEqual([
      { label: "2026-08-01", value: 3 },
      { label: "2026-08-02", value: 4 },
    ]);
  });

  it("skips entries with no numberValue rather than plotting them as 0", () => {
    const points = metricHistoryPoints([
      { date: new Date("2026-08-01"), numberValue: 3, textValue: null },
      { date: new Date("2026-08-02"), numberValue: null, textValue: "MILD" },
    ]);
    expect(points).toEqual([{ label: "2026-08-01", value: 3 }]);
  });

  it("returns an empty array for no entries", () => {
    expect(metricHistoryPoints([])).toEqual([]);
  });
});

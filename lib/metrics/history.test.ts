import { describe, expect, it } from "vitest";
import { metricHistoryPoints } from "./history";

describe("metricHistoryPoints", () => {
  it("maps numeric entries to day-labeled points for a DAILY/WEEKLY metric", () => {
    const points = metricHistoryPoints(
      [
        { id: "e1", date: new Date("2026-08-01"), numberValue: 3, textValue: null },
        { id: "e2", date: new Date("2026-08-02"), numberValue: 4, textValue: null },
      ],
      "DAILY"
    );
    expect(points).toEqual([
      { label: "2026-08-01", value: 3 },
      { label: "2026-08-02", value: 4 },
    ]);
  });

  it("skips entries with no numberValue rather than plotting them as 0", () => {
    const points = metricHistoryPoints(
      [
        { id: "e1", date: new Date("2026-08-01"), numberValue: 3, textValue: null },
        { id: "e2", date: new Date("2026-08-02"), numberValue: null, textValue: "MILD" },
      ],
      "DAILY"
    );
    expect(points).toEqual([{ label: "2026-08-01", value: 3 }]);
  });

  it("labels an AD_HOC metric's points with the full timestamp, so same-day entries stay distinguishable", () => {
    const points = metricHistoryPoints(
      [
        { id: "e1", date: new Date("2026-08-01T09:15:00.000Z"), numberValue: 3, textValue: null },
        { id: "e2", date: new Date("2026-08-01T18:40:00.000Z"), numberValue: 5, textValue: null },
      ],
      "AD_HOC"
    );
    expect(points).toEqual([
      { label: "2026-08-01 09:15", value: 3 },
      { label: "2026-08-01 18:40", value: 5 },
    ]);
  });

  it("returns an empty array for no entries", () => {
    expect(metricHistoryPoints([], "DAILY")).toEqual([]);
  });
});

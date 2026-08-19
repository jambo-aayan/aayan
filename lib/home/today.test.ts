import { describe, expect, it } from "vitest";
import { habitsNotCheckedIn } from "./today";

describe("habitsNotCheckedIn", () => {
  it("keeps only habits with no check-in today", () => {
    const habits = [
      { id: "1", name: "Stretch", areaName: "Ankylosing Spondylitis", todayLevel: null },
      { id: "2", name: "Walk", areaName: "Sleep", todayLevel: "FULL" as const },
      { id: "3", name: "Read", areaName: "Sleep", todayLevel: "MINIMUM" as const },
    ];
    expect(habitsNotCheckedIn(habits).map((h) => h.id)).toEqual(["1"]);
  });

  it("returns an empty list when every habit is already checked in", () => {
    const habits = [{ id: "1", name: "Stretch", areaName: "AS", todayLevel: "FULL" as const }];
    expect(habitsNotCheckedIn(habits)).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import { currentPeriodStart } from "./due";

describe("currentPeriodStart", () => {
  it("returns midnight UTC for a DAILY metric", () => {
    expect(currentPeriodStart("DAILY", new Date("2026-08-21T14:32:00.000Z"))).toEqual(new Date("2026-08-21T00:00:00.000Z"));
  });

  it("returns that week's Monday for a WEEKLY metric", () => {
    // 2026-08-21 is a Friday.
    expect(currentPeriodStart("WEEKLY", new Date("2026-08-21T14:32:00.000Z"))).toEqual(new Date("2026-08-17T00:00:00.000Z"));
  });

  it("returns null for an AD_HOC metric — it has no period", () => {
    expect(currentPeriodStart("AD_HOC", new Date("2026-08-21T14:32:00.000Z"))).toBeNull();
  });
});

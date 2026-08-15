import { describe, expect, it } from "vitest";
import { dailyStreak, weeklyStreak, mondayOf, isEstablished } from "./streak";

// All dates UTC midnight — check-ins are stored as DATE-only.
const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe("mondayOf", () => {
  it("returns the same Monday for a Saturday and the following Sunday", () => {
    // 2026-08-15 is a Saturday; 2026-08-16 is the Sunday immediately after —
    // this is the exact case the original prototype's floor(epochDays/7)
    // got wrong (it could split a Sat/Sun pair across two "weeks").
    const saturday = d("2026-08-15");
    const sunday = d("2026-08-16");
    expect(mondayOf(saturday).toISOString()).toBe(mondayOf(sunday).toISOString());
    expect(mondayOf(saturday).toISOString()).toBe(d("2026-08-10").toISOString());
  });

  it("maps a Monday to itself", () => {
    expect(mondayOf(d("2026-08-10")).toISOString()).toBe(d("2026-08-10").toISOString());
  });

  it("maps a Sunday to the Monday six days earlier", () => {
    expect(mondayOf(d("2026-08-16")).toISOString()).toBe(d("2026-08-10").toISOString());
  });
});

describe("dailyStreak", () => {
  it("is 0 for no check-ins", () => {
    expect(dailyStreak([])).toBe(0);
  });

  it("counts a single consecutive run of calendar days", () => {
    expect(dailyStreak([d("2026-08-10"), d("2026-08-11"), d("2026-08-12")])).toBe(3);
  });

  it("only counts the most recent unbroken run, ignoring an earlier gap", () => {
    const dates = [d("2026-08-01"), d("2026-08-02"), d("2026-08-10"), d("2026-08-11"), d("2026-08-12")];
    expect(dailyStreak(dates)).toBe(3);
  });

  it("ignores date order and duplicate dates in the input", () => {
    expect(dailyStreak([d("2026-08-12"), d("2026-08-10"), d("2026-08-11"), d("2026-08-11")])).toBe(3);
  });
});

describe("weeklyStreak", () => {
  it("is 0 for no check-ins", () => {
    expect(weeklyStreak([])).toBe(0);
  });

  it("counts a Saturday and the following Sunday as the same week (1 week, not 2)", () => {
    expect(weeklyStreak([d("2026-08-15"), d("2026-08-16")])).toBe(1);
  });

  it("counts consecutive Mon-Sun weeks with at least one check-in each", () => {
    // any single day in each week is enough — laundry "Saturday or Sunday"
    const dates = [
      d("2026-08-03"), // Mon, week of Aug 3
      d("2026-08-15"), // Sat, week of Aug 10
      d("2026-08-16"), // Sun, week of Aug 10 (same week as above)
      d("2026-08-17"), // Mon, week of Aug 17
    ];
    expect(weeklyStreak(dates)).toBe(3); // weeks of Aug 3, Aug 10, and Aug 17 are all consecutive
  });

  it("breaks the streak when a whole week has no check-in", () => {
    const dates = [d("2026-08-03"), d("2026-08-17")]; // week of Aug 10 has nothing
    expect(weeklyStreak(dates)).toBe(1);
  });
});

describe("isEstablished", () => {
  it("is true at exactly 7 consecutive daily check-ins", () => {
    expect(isEstablished(7, "DAILY")).toBe(true);
    expect(isEstablished(6, "DAILY")).toBe(false);
  });

  it("is true at exactly 4 consecutive weekly check-ins", () => {
    expect(isEstablished(4, "WEEKLY")).toBe(true);
    expect(isEstablished(3, "WEEKLY")).toBe(false);
  });
});

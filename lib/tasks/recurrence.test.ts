import { describe, expect, it } from "vitest";
import { nextOccurrenceDate } from "./recurrence";

function d(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

describe("nextOccurrenceDate", () => {
  it("adds a day for DAILY", () => {
    expect(nextOccurrenceDate("DAILY", d("2026-08-17"))?.toISOString().slice(0, 10)).toBe("2026-08-18");
  });

  it("adds a week for WEEKLY", () => {
    expect(nextOccurrenceDate("WEEKLY", d("2026-08-17"))?.toISOString().slice(0, 10)).toBe("2026-08-24");
  });

  it("adds a month for MONTHLY", () => {
    expect(nextOccurrenceDate("MONTHLY", d("2026-08-17"))?.toISOString().slice(0, 10)).toBe("2026-09-17");
  });

  it("skips the weekend for WEEKDAYS from a Friday", () => {
    // 2026-08-21 is a Friday.
    expect(nextOccurrenceDate("WEEKDAYS", d("2026-08-21"))?.toISOString().slice(0, 10)).toBe("2026-08-24");
  });

  it("moves one weekday forward for WEEKDAYS on a mid-week day", () => {
    // 2026-08-17 is a Monday.
    expect(nextOccurrenceDate("WEEKDAYS", d("2026-08-17"))?.toISOString().slice(0, 10)).toBe("2026-08-18");
  });

  it("returns null for CUSTOM — no automatic next date", () => {
    expect(nextOccurrenceDate("CUSTOM", d("2026-08-17"))).toBeNull();
  });
});

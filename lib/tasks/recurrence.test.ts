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

  it("jumps to the next chosen weekday for SELECTED_WEEKDAYS", () => {
    // 2026-08-17 is a Monday; Mon(1)/Wed(3)/Fri(5) selected -> next is Wednesday.
    expect(
      nextOccurrenceDate("SELECTED_WEEKDAYS", d("2026-08-17"), { weekdays: [1, 3, 5] })?.toISOString().slice(0, 10)
    ).toBe("2026-08-19");
  });

  it("wraps to next week for SELECTED_WEEKDAYS when today is the last chosen day", () => {
    // 2026-08-21 is a Friday, the only selected day -> next occurrence is the following Friday.
    expect(
      nextOccurrenceDate("SELECTED_WEEKDAYS", d("2026-08-21"), { weekdays: [5] })?.toISOString().slice(0, 10)
    ).toBe("2026-08-28");
  });

  it("returns null for SELECTED_WEEKDAYS with no days chosen", () => {
    expect(nextOccurrenceDate("SELECTED_WEEKDAYS", d("2026-08-17"), { weekdays: [] })).toBeNull();
  });

  it("adds the interval for EVERY_N_DAYS", () => {
    expect(
      nextOccurrenceDate("EVERY_N_DAYS", d("2026-08-17"), { intervalN: 3 })?.toISOString().slice(0, 10)
    ).toBe("2026-08-20");
  });

  it("returns null for EVERY_N_DAYS with no positive interval", () => {
    expect(nextOccurrenceDate("EVERY_N_DAYS", d("2026-08-17"), { intervalN: 0 })).toBeNull();
    expect(nextOccurrenceDate("EVERY_N_DAYS", d("2026-08-17"))).toBeNull();
  });

  it("adds the interval in weeks for EVERY_N_WEEKS", () => {
    expect(
      nextOccurrenceDate("EVERY_N_WEEKS", d("2026-08-17"), { intervalN: 2 })?.toISOString().slice(0, 10)
    ).toBe("2026-08-31");
  });

  it("returns null for EVERY_N_WEEKS with no positive interval", () => {
    expect(nextOccurrenceDate("EVERY_N_WEEKS", d("2026-08-17"), { intervalN: 0 })).toBeNull();
    expect(nextOccurrenceDate("EVERY_N_WEEKS", d("2026-08-17"))).toBeNull();
  });

  it("adds the interval in months for EVERY_N_MONTHS", () => {
    expect(
      nextOccurrenceDate("EVERY_N_MONTHS", d("2026-08-17"), { intervalN: 3 })?.toISOString().slice(0, 10)
    ).toBe("2026-11-17");
  });

  it("returns null for EVERY_N_MONTHS with no positive interval", () => {
    expect(nextOccurrenceDate("EVERY_N_MONTHS", d("2026-08-17"), { intervalN: 0 })).toBeNull();
    expect(nextOccurrenceDate("EVERY_N_MONTHS", d("2026-08-17"))).toBeNull();
  });
});

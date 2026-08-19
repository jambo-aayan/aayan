import { describe, expect, it } from "vitest";
import { habitOccursOn, formatScheduleLabel, type HabitSchedule } from "./schedule";

function d(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

function schedule(overrides: Partial<HabitSchedule>): HabitSchedule {
  return {
    scheduleType: "DAILY",
    scheduleWeekdays: [],
    scheduleIntervalN: null,
    scheduleAnchorDate: null,
    ...overrides,
  };
}

describe("habitOccursOn", () => {
  it("DAILY always occurs", () => {
    expect(habitOccursOn(schedule({ scheduleType: "DAILY" }), d("2026-08-17"), false)).toBe(true);
  });

  it("WEEKDAYS occurs Mon-Fri, not Sat/Sun", () => {
    const s = schedule({ scheduleType: "WEEKDAYS" });
    expect(habitOccursOn(s, d("2026-08-17"), false)).toBe(true); // Monday
    expect(habitOccursOn(s, d("2026-08-21"), false)).toBe(true); // Friday
    expect(habitOccursOn(s, d("2026-08-22"), false)).toBe(false); // Saturday
    expect(habitOccursOn(s, d("2026-08-23"), false)).toBe(false); // Sunday
  });

  it("SELECTED_WEEKDAYS occurs only on the chosen days", () => {
    const s = schedule({ scheduleType: "SELECTED_WEEKDAYS", scheduleWeekdays: [2, 4] }); // Tue, Thu
    expect(habitOccursOn(s, d("2026-08-18"), false)).toBe(true); // Tuesday
    expect(habitOccursOn(s, d("2026-08-17"), false)).toBe(false); // Monday
  });

  it("WEEKLY occurs until done once this week, then stops", () => {
    const s = schedule({ scheduleType: "WEEKLY" });
    expect(habitOccursOn(s, d("2026-08-19"), false)).toBe(true);
    expect(habitOccursOn(s, d("2026-08-19"), true)).toBe(false);
  });

  it("EVERY_N_DAYS occurs every N days from the anchor", () => {
    const s = schedule({ scheduleType: "EVERY_N_DAYS", scheduleIntervalN: 3, scheduleAnchorDate: d("2026-08-17") });
    expect(habitOccursOn(s, d("2026-08-17"), false)).toBe(true); // day 0
    expect(habitOccursOn(s, d("2026-08-18"), false)).toBe(false); // day 1
    expect(habitOccursOn(s, d("2026-08-20"), false)).toBe(true); // day 3
  });

  it("EVERY_N_WEEKS occurs on qualifying weeks until done that week", () => {
    const s = schedule({ scheduleType: "EVERY_N_WEEKS", scheduleIntervalN: 2, scheduleAnchorDate: d("2026-08-17") });
    expect(habitOccursOn(s, d("2026-08-19"), false)).toBe(true); // same week as anchor
    expect(habitOccursOn(s, d("2026-08-26"), false)).toBe(false); // next week, not qualifying
    expect(habitOccursOn(s, d("2026-08-31"), false)).toBe(true); // two weeks later, qualifying
    expect(habitOccursOn(s, d("2026-08-31"), true)).toBe(false); // qualifying but already done
  });

  it("MONTHLY occurs on the anchor's day-of-month, clamped to short months", () => {
    const s = schedule({ scheduleType: "MONTHLY", scheduleAnchorDate: d("2026-01-31") });
    expect(habitOccursOn(s, d("2026-03-31"), false)).toBe(true);
    expect(habitOccursOn(s, d("2026-02-28"), false)).toBe(true); // Feb has no 31st — clamps to the 28th
  });

  it("CUSTOM never auto-occurs", () => {
    expect(habitOccursOn(schedule({ scheduleType: "CUSTOM" }), d("2026-08-17"), false)).toBe(false);
  });
});

describe("formatScheduleLabel", () => {
  it("labels each schedule type", () => {
    expect(formatScheduleLabel(schedule({ scheduleType: "DAILY" }))).toBe("Daily");
    expect(formatScheduleLabel(schedule({ scheduleType: "WEEKDAYS" }))).toBe("Weekdays");
    expect(formatScheduleLabel(schedule({ scheduleType: "SELECTED_WEEKDAYS", scheduleWeekdays: [1, 3, 5] }))).toBe(
      "Mon, Wed, Fri"
    );
    expect(formatScheduleLabel(schedule({ scheduleType: "EVERY_N_DAYS", scheduleIntervalN: 3 }))).toBe(
      "Every 3 days"
    );
    expect(formatScheduleLabel(schedule({ scheduleType: "MONTHLY" }))).toBe("Monthly");
  });
});

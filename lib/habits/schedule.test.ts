import { describe, expect, it } from "vitest";
import { habitOccursOn, formatScheduleLabel, expectedCount, doneCount, type HabitSchedule } from "./schedule";

function d(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

function schedule(overrides: Partial<HabitSchedule>): HabitSchedule {
  return {
    scheduleType: "DAILY",
    scheduleWeekdays: [],
    scheduleIntervalN: null,
    scheduleAnchorDate: null,
    scheduleTargetCount: null,
    ...overrides,
  };
}

function days(startIso: string, count: number): Date[] {
  const start = d(startIso);
  return Array.from({ length: count }, (_, i) => new Date(start.getTime() + i * 24 * 60 * 60 * 1000));
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

  it("PER_WEEK always occurs, regardless of doneThisWeek — the target is a count, not fixed days", () => {
    const s = schedule({ scheduleType: "PER_WEEK", scheduleTargetCount: 4 });
    expect(habitOccursOn(s, d("2026-08-17"), false)).toBe(true);
    expect(habitOccursOn(s, d("2026-08-17"), true)).toBe(true);
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

  it("labels PER_WEEK with its target count", () => {
    expect(formatScheduleLabel(schedule({ scheduleType: "PER_WEEK", scheduleTargetCount: 4 }))).toBe("4× a week");
  });

  it("falls back to a generic label when PER_WEEK has no target count set", () => {
    expect(formatScheduleLabel(schedule({ scheduleType: "PER_WEEK" }))).toBe("× a week");
  });
});

describe("expectedCount", () => {
  it("PER_WEEK: proportional to the window, rounded — round(days/7 * target)", () => {
    const s = schedule({ scheduleType: "PER_WEEK", scheduleTargetCount: 4 });
    expect(expectedCount(s, days("2026-08-17", 7), [])).toBe(4); // exactly one week
    expect(expectedCount(s, days("2026-08-17", 14), [])).toBe(8); // two weeks
    expect(expectedCount(s, days("2026-08-17", 3), [])).toBe(2); // round(3/7*4) = round(1.71) = 2
  });

  it("PER_WEEK with no target count set expects nothing", () => {
    const s = schedule({ scheduleType: "PER_WEEK" });
    expect(expectedCount(s, days("2026-08-17", 7), [])).toBe(0);
  });

  it("DAILY: matches habitOccursOn — every day in the window is expected", () => {
    const s = schedule({ scheduleType: "DAILY" });
    expect(expectedCount(s, days("2026-08-17", 5), [])).toBe(5);
  });

  it("WEEKDAYS: matches habitOccursOn — only Mon-Fri count", () => {
    const s = schedule({ scheduleType: "WEEKDAYS" });
    // 2026-08-17 is a Monday; a 7-day window covers Mon-Sun once, 5 weekdays.
    expect(expectedCount(s, days("2026-08-17", 7), [])).toBe(5);
  });

  it("SELECTED_WEEKDAYS: matches habitOccursOn — only the chosen days count", () => {
    const s = schedule({ scheduleType: "SELECTED_WEEKDAYS", scheduleWeekdays: [2, 4] }); // Tue, Thu
    expect(expectedCount(s, days("2026-08-17", 7), [])).toBe(2);
  });

  it("EVERY_N_DAYS: matches habitOccursOn — every Nth day from the anchor", () => {
    const s = schedule({ scheduleType: "EVERY_N_DAYS", scheduleIntervalN: 3, scheduleAnchorDate: d("2026-08-17") });
    // Days 0-6 from anchor: due on day 0, 3, 6 -> 3 occurrences.
    expect(expectedCount(s, days("2026-08-17", 7), [])).toBe(3);
  });

  it("EVERY_N_WEEKS: matches habitOccursOn — only qualifying weeks, respecting completion", () => {
    const s = schedule({ scheduleType: "EVERY_N_WEEKS", scheduleIntervalN: 2, scheduleAnchorDate: d("2026-08-17") });
    // Anchor week (Aug 17) qualifies, next week doesn't, week after does.
    // Undone: every day of the two qualifying weeks is due (14 days).
    expect(expectedCount(s, days("2026-08-17", 21), [])).toBe(14);
  });

  it("MONTHLY: matches habitOccursOn — one due day per month in the window", () => {
    const s = schedule({ scheduleType: "MONTHLY", scheduleAnchorDate: d("2026-01-31") });
    expect(expectedCount(s, [d("2026-03-31"), d("2026-03-30")], [])).toBe(1);
  });

  it("CUSTOM: matches habitOccursOn — never auto-occurs, so nothing is expected", () => {
    const s = schedule({ scheduleType: "CUSTOM" });
    expect(expectedCount(s, days("2026-08-17", 7), [])).toBe(0);
  });

  it("WEEKLY: expects once per week, respecting completion-as-of-each-day (matches habitOccursOn's doneThisWeek semantics)", () => {
    const s = schedule({ scheduleType: "WEEKLY" });
    // Two full Mon-Sun weeks (2026-08-17 is a Monday), no logged days at all:
    // every day of both weeks is still "due" (never satisfied) under this
    // function's own count — expectedCount doesn't cap at 1/week on its own,
    // it reflects the same isDue the existing callers already compute.
    const twoWeeks = days("2026-08-17", 14);
    expect(expectedCount(s, twoWeeks, [])).toBe(14);
    // Logging once on the first Monday of each week satisfies that week from
    // that day on — 2 due days (the two Mondays themselves, still due as of
    // being logged) instead of 14.
    expect(expectedCount(s, twoWeeks, [d("2026-08-17"), d("2026-08-24")])).toBe(2);
  });
});

describe("doneCount", () => {
  it("PER_WEEK: counts every logged day in the window unconditionally — no isDue gate", () => {
    const s = schedule({ scheduleType: "PER_WEEK", scheduleTargetCount: 4 });
    const window = days("2026-08-17", 7);
    const logged = [d("2026-08-17"), d("2026-08-18"), d("2026-08-19"), d("2026-08-20"), d("2026-08-21")];
    expect(doneCount(s, window, logged)).toBe(5);
  });

  it("PER_WEEK: done can exceed expected — over-performing is legal, not clamped", () => {
    const s = schedule({ scheduleType: "PER_WEEK", scheduleTargetCount: 4 });
    const window = days("2026-08-17", 7);
    const logged = [
      d("2026-08-17"),
      d("2026-08-18"),
      d("2026-08-19"),
      d("2026-08-20"),
      d("2026-08-21"),
      d("2026-08-22"),
    ];
    expect(expectedCount(s, window, logged)).toBe(4);
    expect(doneCount(s, window, logged)).toBe(6);
    expect(doneCount(s, window, logged)).toBeGreaterThan(expectedCount(s, window, logged));
  });

  it("DAILY: restricted to due days — a log outside the window doesn't count", () => {
    const s = schedule({ scheduleType: "DAILY" });
    const window = days("2026-08-17", 3);
    const logged = [d("2026-08-17"), d("2026-08-19"), d("2026-08-25")];
    expect(doneCount(s, window, logged)).toBe(2);
  });

  it("WEEKLY: only counts a logged day if it was actually due that day", () => {
    const s = schedule({ scheduleType: "WEEKLY" });
    const window = days("2026-08-17", 7); // one Mon-Sun week
    // Logged Monday and Wednesday of the same week: Monday is due (nothing
    // logged yet that week) and counts; Wednesday is not due (the week was
    // already satisfied by Monday) and doesn't count.
    const logged = [d("2026-08-17"), d("2026-08-19")];
    expect(doneCount(s, window, logged)).toBe(1);
  });
});

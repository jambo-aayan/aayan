import { describe, expect, it } from "vitest";
import {
  validateCreateSystemInput,
  canSetParent,
  resolveBackdate,
  isValidRating,
  isValidMeasureNumber,
  expectedOccurrenceDates,
  classifyOccurrences,
} from "./logic";

describe("validateCreateSystemInput", () => {
  it("rejects a blank name", () => {
    expect(validateCreateSystemInput({ name: "  ", type: "PROCESS", review: null, criteria: null })).toEqual({
      ok: false,
      error: "Give the System a name first.",
    });
  });

  it("accepts a Process with just a name", () => {
    expect(
      validateCreateSystemInput({ name: "Payday routine", type: "PROCESS", review: null, criteria: null })
    ).toEqual({ ok: true });
  });

  it("rejects an Experiment with no review date", () => {
    expect(
      validateCreateSystemInput({
        name: "Elimination diet",
        type: "EXPERIMENT",
        review: null,
        criteria: "Symptoms improve",
      })
    ).toEqual({ ok: false, error: "Experiments need a review date." });
  });

  it("rejects an Experiment with no criteria", () => {
    expect(
      validateCreateSystemInput({
        name: "Elimination diet",
        type: "EXPERIMENT",
        review: new Date("2026-09-01"),
        criteria: "  ",
      })
    ).toEqual({ ok: false, error: "Experiments need success criteria." });
  });

  it("accepts an Experiment with both review date and criteria", () => {
    expect(
      validateCreateSystemInput({
        name: "Elimination diet",
        type: "EXPERIMENT",
        review: new Date("2026-09-01"),
        criteria: "Symptoms improve",
      })
    ).toEqual({ ok: true });
  });
});

describe("canSetParent", () => {
  it("allows setting a parent when the System has no children", () => {
    expect(canSetParent(false)).toBe(true);
  });

  it("rejects setting a parent when the System already has children", () => {
    expect(canSetParent(true)).toBe(false);
  });
});

describe("resolveBackdate", () => {
  const today = new Date("2026-08-27");

  it("accepts a past date", () => {
    const result = resolveBackdate(new Date("2026-08-20"), today);
    expect(result.ok).toBe(true);
  });

  it("accepts today", () => {
    const result = resolveBackdate(new Date("2026-08-27"), today);
    expect(result.ok).toBe(true);
  });

  it("rejects a future date", () => {
    expect(resolveBackdate(new Date("2026-08-28"), today)).toEqual({
      ok: false,
      error: "That date hasn't happened yet.",
    });
  });
});

describe("isValidRating", () => {
  it("accepts 1 through 5", () => {
    expect([1, 2, 3, 4, 5].every(isValidRating)).toBe(true);
  });

  it("rejects out-of-range and non-integer values", () => {
    expect(isValidRating(0)).toBe(false);
    expect(isValidRating(6)).toBe(false);
    expect(isValidRating(3.5)).toBe(false);
  });
});

describe("isValidMeasureNumber", () => {
  it("accepts finite numbers, including decimals and negatives", () => {
    expect(isValidMeasureNumber(78.4)).toBe(true);
    expect(isValidMeasureNumber(-5)).toBe(true);
    expect(isValidMeasureNumber(0)).toBe(true);
  });

  it("rejects NaN and Infinity", () => {
    expect(isValidMeasureNumber(NaN)).toBe(false);
    expect(isValidMeasureNumber(Infinity)).toBe(false);
  });
});

describe("expectedOccurrenceDates", () => {
  const anchor = new Date("2026-08-01");

  it("computes every-N-days occurrences up to the bound", () => {
    const dates = expectedOccurrenceDates(
      { cadenceDays: 7, anchorDate: anchor, endCondition: "FIXED_COUNT", endValue: null, reviewDate: null },
      new Date("2026-08-22")
    );
    expect(dates).toEqual([
      new Date("2026-08-01"),
      new Date("2026-08-08"),
      new Date("2026-08-15"),
      new Date("2026-08-22"),
    ]);
  });

  it("stops at a fixed occurrence count", () => {
    const dates = expectedOccurrenceDates(
      { cadenceDays: 7, anchorDate: anchor, endCondition: "FIXED_COUNT", endValue: 2, reviewDate: null },
      new Date("2026-12-01")
    );
    expect(dates).toEqual([new Date("2026-08-01"), new Date("2026-08-08")]);
  });

  it("stops at the System's review date for REVIEW_DATE templates", () => {
    const dates = expectedOccurrenceDates(
      { cadenceDays: 7, anchorDate: anchor, endCondition: "REVIEW_DATE", endValue: null, reviewDate: new Date("2026-08-10") },
      new Date("2026-12-01")
    );
    expect(dates).toEqual([new Date("2026-08-01"), new Date("2026-08-08")]);
  });

  it("normalizes a full-precision anchor/bound (e.g. a step's createdAt, or `now`) to midnight UTC", () => {
    const dates = expectedOccurrenceDates(
      {
        cadenceDays: 7,
        anchorDate: new Date("2026-08-01T14:32:07.123Z"),
        endCondition: "FIXED_COUNT",
        endValue: null,
        reviewDate: null,
      },
      new Date("2026-08-08T09:00:00.000Z")
    );
    expect(dates).toEqual([new Date("2026-08-01"), new Date("2026-08-08")]);
  });
});

describe("classifyOccurrences", () => {
  const expected = [new Date("2026-08-01"), new Date("2026-08-08"), new Date("2026-08-15")];

  it("marks a log on the expected date as ON_TIME", () => {
    const result = classifyOccurrences(expected, [new Date("2026-08-01")], new Date("2026-08-20"));
    expect(result[0]).toBe("ON_TIME");
  });

  it("marks a log after the expected date (but before the next) as LATE", () => {
    const result = classifyOccurrences(expected, [new Date("2026-08-03")], new Date("2026-08-20"));
    expect(result[0]).toBe("LATE");
  });

  it("marks a window with no log, once closed, as SKIPPED", () => {
    const result = classifyOccurrences(expected, [], new Date("2026-08-20"));
    expect(result[0]).toBe("SKIPPED");
    expect(result[1]).toBe("SKIPPED");
  });

  it("doesn't mark the final expected date as skipped while its window is still open", () => {
    const result = classifyOccurrences(expected, [], new Date("2026-08-15"));
    expect(result[2]).toBe("ON_TIME");
  });

  it("still matches ON_TIME when the logged date has time-of-day precision (a @db.Date column stores midnight, but callers may not normalize before passing)", () => {
    const result = classifyOccurrences(expected, [new Date("2026-08-01T23:59:00.000Z")], new Date("2026-08-20"));
    expect(result[0]).toBe("ON_TIME");
  });
});

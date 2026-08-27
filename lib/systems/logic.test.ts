import { describe, expect, it } from "vitest";
import {
  validateCreateSystemInput,
  canSetParent,
  resolveBackdate,
  isValidRating,
  isValidMeasureNumber,
  expectedOccurrenceDates,
  classifyOccurrences,
  validatePhotoUpload,
  MAX_PHOTO_BYTES,
  resolveRunReview,
  isVerdictDue,
  hasCriteria,
  describeLoad,
  timelineBar,
  rollupCategory,
  sortRollup,
  filterRollupByName,
  type RollupInput,
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
  it("allows setting a parent when neither System is already nested", () => {
    expect(canSetParent(false, false)).toBe(true);
  });

  it("rejects setting a parent when the System already has children", () => {
    expect(canSetParent(true, false)).toBe(false);
  });

  it("rejects nesting under a candidate parent that is itself already a child", () => {
    expect(canSetParent(false, true)).toBe(false);
  });

  it("rejects when both conditions hold", () => {
    expect(canSetParent(true, true)).toBe(false);
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

describe("validatePhotoUpload", () => {
  it("accepts a standard image type under the size cap", () => {
    expect(validatePhotoUpload("image/jpeg", 1024)).toEqual({ ok: true });
  });

  it("rejects a non-image MIME type", () => {
    expect(validatePhotoUpload("application/pdf", 1024)).toEqual({
      ok: false,
      error: "That doesn't look like an image — try a JPEG, PNG, WebP, GIF, or HEIC.",
    });
  });

  it("rejects a file over 10MB", () => {
    expect(validatePhotoUpload("image/png", MAX_PHOTO_BYTES + 1)).toEqual({
      ok: false,
      error: "That photo is too large — keep it under 10MB.",
    });
  });

  it("accepts a file exactly at the size cap", () => {
    expect(validatePhotoUpload("image/png", MAX_PHOTO_BYTES)).toEqual({ ok: true });
  });
});

describe("resolveRunReview", () => {
  it("resolves a relative offset from the run's start", () => {
    const result = resolveRunReview({ review: null, reviewOffsetDays: 14 }, new Date("2026-08-01"));
    expect(result).toEqual(new Date("2026-08-15"));
  });

  it("copies an absolute review date straight through", () => {
    const result = resolveRunReview({ review: new Date("2026-09-01"), reviewOffsetDays: null }, new Date("2026-08-01"));
    expect(result).toEqual(new Date("2026-09-01"));
  });

  it("prefers the relative offset when both are somehow set", () => {
    const result = resolveRunReview(
      { review: new Date("2026-09-01"), reviewOffsetDays: 7 },
      new Date("2026-08-01")
    );
    expect(result).toEqual(new Date("2026-08-08"));
  });

  it("returns null for a Process template (neither field set)", () => {
    expect(resolveRunReview({ review: null, reviewOffsetDays: null }, new Date("2026-08-01"))).toBeNull();
  });
});

describe("isVerdictDue", () => {
  it("is false when there's no review date", () => {
    expect(isVerdictDue(null, new Date("2026-08-20"))).toBe(false);
  });

  it("is false before the review date", () => {
    expect(isVerdictDue(new Date("2026-08-20"), new Date("2026-08-19"))).toBe(false);
  });

  it("is true on or after the review date", () => {
    expect(isVerdictDue(new Date("2026-08-20"), new Date("2026-08-20"))).toBe(true);
    expect(isVerdictDue(new Date("2026-08-20"), new Date("2026-08-25"))).toBe(true);
  });
});

describe("hasCriteria", () => {
  it("is false for null or blank criteria", () => {
    expect(hasCriteria(null)).toBe(false);
    expect(hasCriteria("   ")).toBe(false);
  });

  it("is true for real criteria text", () => {
    expect(hasCriteria("Symptoms improve")).toBe(true);
  });
});

describe("describeLoad", () => {
  it("returns null when every Area is at zero", () => {
    expect(describeLoad([{ name: "Sleep", count: 0 }, { name: "Diet", count: 0 }])).toBeNull();
  });

  it("highlights the busiest Area against the total", () => {
    const result = describeLoad([
      { name: "Training & body", count: 3 },
      { name: "Diet", count: 2 },
      { name: "Sleep", count: 4 },
    ]);
    expect(result).toBe("4 of 9 sit in Sleep.");
  });

  it("also calls out an Area sitting at zero", () => {
    const result = describeLoad([
      { name: "Training & body", count: 3 },
      { name: "Diet", count: 6 },
      { name: "Sleep", count: 0 },
    ]);
    expect(result).toBe("6 of 9 sit in Diet. Nothing at all in Sleep.");
  });
});

describe("timelineBar", () => {
  const today = new Date("2026-08-27");

  it("is always open-ended (no end offset) for a Process", () => {
    expect(timelineBar({ id: "a", type: "PROCESS", review: new Date("2026-09-01") }, today)).toEqual({
      id: "a",
      endOffsetDays: null,
    });
  });

  it("is open-ended for an Experiment with no review date", () => {
    expect(timelineBar({ id: "a", type: "EXPERIMENT", review: null }, today)).toEqual({ id: "a", endOffsetDays: null });
  });

  it("ends at the review date's offset from today for an Experiment", () => {
    expect(timelineBar({ id: "a", type: "EXPERIMENT", review: new Date("2026-09-06") }, today)).toEqual({
      id: "a",
      endOffsetDays: 10,
    });
  });

  it("clamps an overdue review to zero rather than a negative offset", () => {
    expect(timelineBar({ id: "a", type: "EXPERIMENT", review: new Date("2026-08-20") }, today)).toEqual({
      id: "a",
      endOffsetDays: 0,
    });
  });
});

function rollupSystem(overrides: Partial<RollupInput>): RollupInput {
  return {
    id: "a",
    type: "PROCESS",
    state: "ACTIVE",
    review: null,
    verdict: null,
    stepsDone: 0,
    totalSteps: 0,
    ...overrides,
  };
}

describe("rollupCategory", () => {
  const today = new Date("2026-08-27");

  it("is INACTIVE for any non-active state, regardless of type", () => {
    expect(rollupCategory(rollupSystem({ state: "PAUSED", type: "EXPERIMENT" }), today)).toBe("INACTIVE");
  });

  it("is REVIEW_DUE for an active Experiment past its review with no verdict", () => {
    expect(rollupCategory(rollupSystem({ type: "EXPERIMENT", review: new Date("2026-08-20") }), today)).toBe(
      "REVIEW_DUE"
    );
  });

  it("is REVIEW_UPCOMING for an active Experiment before its review", () => {
    expect(rollupCategory(rollupSystem({ type: "EXPERIMENT", review: new Date("2026-09-01") }), today)).toBe(
      "REVIEW_UPCOMING"
    );
  });

  it("is VERDICTED once a verdict is set, even past the review date", () => {
    expect(
      rollupCategory(rollupSystem({ type: "EXPERIMENT", review: new Date("2026-08-20"), verdict: "CONTINUE" }), today)
    ).toBe("VERDICTED");
  });

  it("is IN_PROGRESS for an active Process", () => {
    expect(rollupCategory(rollupSystem({ type: "PROCESS" }), today)).toBe("IN_PROGRESS");
  });
});

describe("sortRollup", () => {
  const today = new Date("2026-08-27");

  it("puts REVIEW_DUE first, then soonest REVIEW_UPCOMING, then IN_PROGRESS, then VERDICTED, then INACTIVE", () => {
    const systems: RollupInput[] = [
      rollupSystem({ id: "inactive", state: "PAUSED" }),
      rollupSystem({ id: "verdicted", type: "EXPERIMENT", verdict: "STOP" }),
      rollupSystem({ id: "in-progress", type: "PROCESS", stepsDone: 1, totalSteps: 4 }),
      rollupSystem({ id: "upcoming-far", type: "EXPERIMENT", review: new Date("2026-09-10") }),
      rollupSystem({ id: "upcoming-near", type: "EXPERIMENT", review: new Date("2026-09-01") }),
      rollupSystem({ id: "due", type: "EXPERIMENT", review: new Date("2026-08-20") }),
    ];
    const result = sortRollup(systems, today);
    expect(result.map((s) => s.id)).toEqual([
      "due",
      "upcoming-near",
      "upcoming-far",
      "in-progress",
      "verdicted",
      "inactive",
    ]);
  });

  it("orders in-progress Processes least-complete first", () => {
    const systems: RollupInput[] = [
      rollupSystem({ id: "mostly-done", type: "PROCESS", stepsDone: 4, totalSteps: 5 }),
      rollupSystem({ id: "just-started", type: "PROCESS", stepsDone: 1, totalSteps: 5 }),
    ];
    expect(sortRollup(systems, today).map((s) => s.id)).toEqual(["just-started", "mostly-done"]);
  });
});

describe("filterRollupByName", () => {
  const rows = [{ name: "Elimination diet" }, { name: "Payday routine" }, { name: "Training block" }];

  it("returns every row when the query is empty or blank", () => {
    expect(filterRollupByName(rows, "")).toEqual(rows);
    expect(filterRollupByName(rows, "   ")).toEqual(rows);
  });

  it("filters to rows whose name contains the query, case-insensitively", () => {
    expect(filterRollupByName(rows, "diet")).toEqual([{ name: "Elimination diet" }]);
    expect(filterRollupByName(rows, "PAYDAY")).toEqual([{ name: "Payday routine" }]);
  });

  it("matches a substring anywhere in the name", () => {
    expect(filterRollupByName(rows, "rou")).toEqual([{ name: "Payday routine" }]);
  });

  it("returns an empty array when nothing matches", () => {
    expect(filterRollupByName(rows, "nonexistent")).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import { validateCreateSystemInput, canSetParent } from "./logic";

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

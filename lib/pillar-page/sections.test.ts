import { describe, expect, it } from "vitest";
import { resolveSectionOrder, type SectionType } from "./sections";

const PRESENT: SectionType[] = ["northStar", "goals", "systems", "thoughts"];

describe("resolveSectionOrder", () => {
  it("returns every present section, visible, in default order when config is null", () => {
    expect(resolveSectionOrder(PRESENT, null)).toEqual([
      { type: "northStar", visible: true },
      { type: "goals", visible: true },
      { type: "systems", visible: true },
      { type: "thoughts", visible: true },
    ]);
  });

  it("respects a stored order and visibility over the default", () => {
    const config = [
      { type: "systems" as const, visible: true },
      { type: "northStar" as const, visible: false },
      { type: "goals" as const, visible: true },
      { type: "thoughts" as const, visible: true },
    ];
    expect(resolveSectionOrder(PRESENT, config)).toEqual(config);
  });

  it("drops a configured type that isn't present on this page instance", () => {
    const config = [
      { type: "habits" as const, visible: true },
      { type: "northStar" as const, visible: true },
      { type: "goals" as const, visible: true },
      { type: "systems" as const, visible: true },
      { type: "thoughts" as const, visible: true },
    ];
    expect(resolveSectionOrder(PRESENT, config)).toEqual([
      { type: "northStar", visible: true },
      { type: "goals", visible: true },
      { type: "systems", visible: true },
      { type: "thoughts", visible: true },
    ]);
  });

  it("appends a present type missing from config, visible, at the end", () => {
    const config = [
      { type: "northStar" as const, visible: true },
      { type: "goals" as const, visible: false },
    ];
    expect(resolveSectionOrder(PRESENT, config)).toEqual([
      { type: "northStar", visible: true },
      { type: "goals", visible: false },
      { type: "systems", visible: true },
      { type: "thoughts", visible: true },
    ]);
  });

  it("dedupes a malformed config with a duplicate type, keeping the first occurrence", () => {
    const config = [
      { type: "goals" as const, visible: true },
      { type: "northStar" as const, visible: true },
      { type: "goals" as const, visible: false },
    ];
    expect(resolveSectionOrder(PRESENT, config)).toEqual([
      { type: "goals", visible: true },
      { type: "northStar", visible: true },
      { type: "systems", visible: true },
      { type: "thoughts", visible: true },
    ]);
  });

  it("handles an empty config the same as one covering nothing present", () => {
    expect(resolveSectionOrder(PRESENT, [])).toEqual([
      { type: "northStar", visible: true },
      { type: "goals", visible: true },
      { type: "systems", visible: true },
      { type: "thoughts", visible: true },
    ]);
  });
});

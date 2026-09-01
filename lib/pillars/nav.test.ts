import { describe, expect, it } from "vitest";
import { pillarHref } from "./nav";

describe("pillarHref", () => {
  it("routes the Finance pillar to its existing literal /finances route", () => {
    expect(pillarHref("finance")).toBe("/finances");
  });

  it("routes every other pillar to the generic /[pillarId] route", () => {
    expect(pillarHref("health")).toBe("/health");
    expect(pillarHref("miscellaneous")).toBe("/miscellaneous");
    expect(pillarHref("some-new-pillar-id")).toBe("/some-new-pillar-id");
  });
});

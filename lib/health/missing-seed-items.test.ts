import { describe, expect, it } from "vitest";
import { missingSeedItems } from "./missing-seed-items";

const SEED = [
  { id: "a", name: "A" },
  { id: "b", name: "B" },
  { id: "c", name: "C" },
] as const;

describe("missingSeedItems", () => {
  it("returns the full seed list when nothing exists yet", () => {
    expect(missingSeedItems(SEED, [])).toEqual([SEED[0], SEED[1], SEED[2]]);
  });

  it("returns only the items not already present", () => {
    expect(missingSeedItems(SEED, ["a", "c"])).toEqual([SEED[1]]);
  });

  it("returns an empty list once every seed item exists", () => {
    expect(missingSeedItems(SEED, ["a", "b", "c"])).toEqual([]);
  });

  it("ignores existing ids that aren't in the seed list", () => {
    expect(missingSeedItems(SEED, ["z", "a"])).toEqual([SEED[1], SEED[2]]);
  });
});

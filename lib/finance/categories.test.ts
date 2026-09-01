import { describe, expect, it } from "vitest";
import { resolveCategoryId } from "./categories";

const CATEGORIES = [
  { id: "cat-food", name: "Food" },
  { id: "cat-housing", name: "Housing" },
  { id: "cat-other", name: "Other" },
];

describe("resolveCategoryId", () => {
  it("matches a category name exactly", () => {
    expect(resolveCategoryId(CATEGORIES, "Food", "cat-other")).toBe("cat-food");
  });

  it("matches case-insensitively", () => {
    expect(resolveCategoryId(CATEGORIES, "food", "cat-other")).toBe("cat-food");
    expect(resolveCategoryId(CATEGORIES, "HOUSING", "cat-other")).toBe("cat-housing");
  });

  it("trims whitespace before matching", () => {
    expect(resolveCategoryId(CATEGORIES, "  Food  ", "cat-other")).toBe("cat-food");
  });

  it("falls back when no category matches", () => {
    expect(resolveCategoryId(CATEGORIES, "Dining", "cat-other")).toBe("cat-other");
  });

  it("falls back on an empty guess", () => {
    expect(resolveCategoryId(CATEGORIES, "", "cat-other")).toBe("cat-other");
  });

  it("falls back when the category list is empty", () => {
    expect(resolveCategoryId([], "Food", "cat-other")).toBe("cat-other");
  });
});

import { describe, expect, it } from "vitest";
import { fallbackCategoryId, leafCategories, leafCategoryLabel, resolveCategoryId } from "./categories";

const FOOD = { id: "cat-food", name: "Food", parentId: null };
const DINING = { id: "cat-dining", name: "Dining Out", parentId: "cat-food" };
const SHOPPING = { id: "cat-shopping", name: "Shopping", parentId: null };
const SHOPPING_GENERAL = { id: "cat-shopping-general", name: "General", parentId: "cat-shopping" };
const TRAVEL = { id: "cat-travel", name: "Travel", parentId: null };
const TRAVEL_GENERAL = { id: "cat-travel-general", name: "General", parentId: "cat-travel" };
const OTHER = { id: "cat-other", name: "Other", parentId: null };
const UNCATEGORIZED = { id: "cat-uncategorized", name: "Uncategorized", parentId: "cat-other" };

const CATEGORIES = [FOOD, DINING, SHOPPING, SHOPPING_GENERAL, TRAVEL, TRAVEL_GENERAL, OTHER, UNCATEGORIZED];

describe("leafCategoryLabel", () => {
  it("prefixes a subcategory with its parent's name", () => {
    expect(leafCategoryLabel(CATEGORIES, DINING)).toBe("Food: Dining Out");
  });

  it("disambiguates same-named leaves under different parents", () => {
    expect(leafCategoryLabel(CATEGORIES, SHOPPING_GENERAL)).toBe("Shopping: General");
    expect(leafCategoryLabel(CATEGORIES, TRAVEL_GENERAL)).toBe("Travel: General");
  });
});

describe("leafCategories", () => {
  it("returns only rows with a parent, never top-level categories", () => {
    expect(leafCategories(CATEGORIES)).toEqual([DINING, SHOPPING_GENERAL, TRAVEL_GENERAL, UNCATEGORIZED]);
  });
});

describe("fallbackCategoryId", () => {
  it("resolves to the Other > Uncategorized leaf", () => {
    expect(fallbackCategoryId(CATEGORIES)).toBe("cat-uncategorized");
  });
});

describe("resolveCategoryId", () => {
  it("matches a leaf's composite label exactly", () => {
    expect(resolveCategoryId(CATEGORIES, "Food: Dining Out", "cat-uncategorized")).toBe("cat-dining");
  });

  it("matches case-insensitively", () => {
    expect(resolveCategoryId(CATEGORIES, "food: dining out", "cat-uncategorized")).toBe("cat-dining");
  });

  it("trims whitespace before matching", () => {
    expect(resolveCategoryId(CATEGORIES, "  Food: Dining Out  ", "cat-uncategorized")).toBe("cat-dining");
  });

  it("disambiguates same-named leaves by parent", () => {
    expect(resolveCategoryId(CATEGORIES, "Shopping: General", "cat-uncategorized")).toBe("cat-shopping-general");
    expect(resolveCategoryId(CATEGORIES, "Travel: General", "cat-uncategorized")).toBe("cat-travel-general");
  });

  it("never matches a top-level category name alone", () => {
    expect(resolveCategoryId(CATEGORIES, "Food", "cat-uncategorized")).toBe("cat-uncategorized");
  });

  it("falls back when no leaf matches", () => {
    expect(resolveCategoryId(CATEGORIES, "Food: Dessert", "cat-uncategorized")).toBe("cat-uncategorized");
  });

  it("falls back on an empty guess", () => {
    expect(resolveCategoryId(CATEGORIES, "", "cat-uncategorized")).toBe("cat-uncategorized");
  });

  it("falls back when the category list is empty", () => {
    expect(resolveCategoryId([], "Food: Dining Out", "cat-uncategorized")).toBe("cat-uncategorized");
  });
});

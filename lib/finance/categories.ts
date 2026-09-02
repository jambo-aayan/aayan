/**
 * The fixed, system-managed category hierarchy, pre-seeded onto the real
 * Category table by the 20260902000000_category_hierarchy migration
 * (#173, ADR-0015) — kept here too as the single source of truth the
 * migration's seed values are meant to mirror. Two levels only (a
 * top-level category and its subcategories) — a Transaction always
 * categorizes at the leaf (subcategory) level, never the top level
 * directly (see the Category model's doc comment in schema.prisma).
 * "Other" > "Uncategorized" is the fallback leaf for anything that
 * doesn't match — see `resolveCategoryId`. This list is no longer
 * user-editable (Settings shows it read-only, #175); changing it means
 * editing this file and writing a new migration, not a UI action.
 */
export const CATEGORY_HIERARCHY: { name: string; subcategories: string[] }[] = [
  { name: "Housing", subcategories: ["Rent/Mortgage", "Utilities", "Home Insurance", "Maintenance & Repairs"] },
  { name: "Food", subcategories: ["Groceries", "Dining Out", "Coffee & Takeaway"] },
  { name: "Transport", subcategories: ["Fuel", "Public Transport", "Parking & Tolls", "Vehicle Maintenance"] },
  { name: "Shopping", subcategories: ["Clothing", "Electronics", "Household Goods", "General"] },
  { name: "Entertainment", subcategories: ["Streaming & Subscriptions", "Events & Outings", "Hobbies"] },
  { name: "Health", subcategories: ["Medical", "Fitness", "Personal Care"] },
  { name: "Travel", subcategories: ["Flights & Transport", "Accommodation", "General"] },
  { name: "Bills", subcategories: ["Phone & Internet", "Insurance (non-home)", "Memberships"] },
  { name: "Income", subcategories: ["Salary", "Transfers In", "Other Income"] },
  { name: "Transfers", subcategories: ["Internal Transfers", "Savings"] },
  { name: "Other", subcategories: ["Uncategorized"] },
];

export type CategoryOption = { id: string; name: string; parentId: string | null };

/** A leaf (subcategory) as "Parent: Subcategory" — subcategory names
 * alone aren't globally unique across different parents (e.g. "General"
 * exists under both Shopping and Travel), so this composite label is
 * both what the AI categorizer is asked to choose from (#174) and what
 * `resolveCategoryId` matches a guess against. */
export function leafCategoryLabel(categories: CategoryOption[], leaf: CategoryOption): string {
  const parent = categories.find((c) => c.id === leaf.parentId);
  return parent ? `${parent.name}: ${leaf.name}` : leaf.name;
}

/** Every leaf (subcategory) in `categories` — the only level a
 * Transaction is ever categorized at (see ADR-0015's #173 addendum). */
export function leafCategories(categories: CategoryOption[]): CategoryOption[] {
  return categories.filter((c) => c.parentId !== null);
}

/** The system fallback leaf — "Other" > "Uncategorized" — for a category
 * guess that doesn't match anything real. Centralized here since the two
 * independent callers that need it (statement upload, spreadsheet
 * import) would otherwise each hand-roll a slightly different lookup.
 * At least one Category always exists post-#173's seed migration, so
 * falling all the way back to `categories[0]` is a defensive last
 * resort only, never expected to be hit. */
export function fallbackCategoryId(categories: CategoryOption[]): string {
  const other = categories.find((c) => c.parentId === null && c.name.toLowerCase() === "other");
  const leaf = other && categories.find((c) => c.parentId === other.id);
  return (leaf ?? categories[0]).id;
}

/** Turns a category guess (from Gemini's statement extraction, or any
 * other untrusted source) into a real categoryId — matched
 * case-insensitively against every leaf's "Parent: Subcategory" label
 * (never a top-level category — see `leafCategoryLabel`), falling back
 * to `fallbackId` when nothing matches. Pure — no DB access, so the
 * caller fetches `categories` once and can call this per-row. */
export function resolveCategoryId(categories: CategoryOption[], guessedName: string, fallbackId: string): string {
  const normalized = guessedName.trim().toLowerCase();
  if (!normalized) return fallbackId;
  const match = leafCategories(categories).find((c) => leafCategoryLabel(categories, c).toLowerCase() === normalized);
  return match?.id ?? fallbackId;
}

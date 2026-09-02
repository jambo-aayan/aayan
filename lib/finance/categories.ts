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

/** Turns a free-text category guess (from Gemini's statement extraction,
 * or any other untrusted source) into a real categoryId — case-
 * insensitively matched against the user's actual Category list, falling
 * back to `fallbackId` (the caller's "Other" > "Uncategorized" leaf)
 * when nothing matches. Pure — no DB access, so the caller fetches
 * `categories` once and can call this per-row.
 *
 * Still matches against every category (parent and leaf alike) rather
 * than leaves only — constraining the guess (and the extraction prompt
 * feeding it) to leaf subcategories only is #174's job, not this one. */
export function resolveCategoryId(categories: CategoryOption[], guessedName: string, fallbackId: string): string {
  const normalized = guessedName.trim().toLowerCase();
  if (!normalized) return fallbackId;
  const match = categories.find((c) => c.name.toLowerCase() === normalized);
  return match?.id ?? fallbackId;
}

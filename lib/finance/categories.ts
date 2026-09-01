/**
 * Starting categories, pre-seeded onto the real Category table by the
 * 20260901000000_category_taxonomy migration (ADR-0015) — kept here too
 * as the single source of truth the migration's seed values are meant to
 * mirror, and for anything that wants to reference the default set by
 * name (e.g. a fresh-environment sanity check).
 */
export const DEFAULT_CATEGORIES = ["Housing", "Food", "Transport", "Shopping", "Entertainment", "Other"];

export type CategoryOption = { id: string; name: string };

/** Turns a free-text category guess (from Gemini's statement extraction,
 * or any other untrusted source) into a real categoryId — case-
 * insensitively matched against the user's actual Category list, falling
 * back to `fallbackId` (the caller's "Other" category) when nothing
 * matches. Pure — no DB access, so the caller fetches `categories` once
 * and can call this per-row. */
export function resolveCategoryId(categories: CategoryOption[], guessedName: string, fallbackId: string): string {
  const normalized = guessedName.trim().toLowerCase();
  if (!normalized) return fallbackId;
  const match = categories.find((c) => c.name.toLowerCase() === normalized);
  return match?.id ?? fallbackId;
}

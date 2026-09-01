import type { ReactNode } from "react";

/** The section types a Pillar/Area page can show (#157/ADR-0016). Not every
 * page builds all of them — a Pillar page has no Habits/Tasks sections
 * (Health's original page never had them, they're Area-scoped only), an
 * Area page has every one. `resolveSectionOrder` below (#160) works over
 * whatever subset a given page instance actually builds, not a hardcoded
 * assumption of a fixed set.
 *
 * `charts`/`table` (#161/ADR-0017) are the one exception to "each section
 * shows at most once" — each renders as a whole *zone* holding any number
 * of Visual instances, not a single card. resolveSectionOrder needs no
 * changes to support this: toggling/reordering "charts" works exactly like
 * toggling/reordering "goals", only what the section *contains* differs. */
export type SectionType = "northStar" | "goals" | "habits" | "systems" | "tasks" | "thoughts" | "charts" | "table";

export const SECTION_LABELS: Record<SectionType, string> = {
  northStar: "North Star",
  goals: "Goals",
  habits: "Habits",
  systems: "Systems",
  tasks: "Tasks",
  thoughts: "Thoughts",
  charts: "Charts",
  table: "Table",
};

export type PageSection = { type: SectionType; node: ReactNode };

export type SectionConfigEntry = { type: SectionType; visible: boolean };

/** Given the section types actually built for this page instance
 * (`present` — a Pillar page and an Area page build a different subset,
 * see each page.tsx's own `sections` array) and this Pillar/Area's stored
 * config (or null, meaning "never configured"), produces the final
 * ordered, filtered list to render (#160/ADR-0016).
 *
 * Pure and dependency-free — no Prisma/React — so it's directly
 * unit-testable, unlike the pages/actions that call it.
 *
 * Handles drift between `config` and `present` gracefully rather than
 * assuming they always match exactly: a `config` entry for a type that
 * isn't in `present` (e.g. stale config from before a section type existed
 * on this page, or the page instance genuinely has fewer sections this
 * time) is dropped; a `present` type missing from `config` (e.g. a new
 * section type shipped after this Pillar/Area's config was last saved) is
 * appended at the end, visible — so a new section type always shows up
 * rather than silently vanishing until the user notices and re-toggles it.
 *
 * Also dedupes `config` by first occurrence of each type — nothing in this
 * app writes a config with a duplicate type today (SectionManager always
 * reorders/toggles an already-deduped array), but a malformed/hand-edited
 * one shouldn't render the same section's Card twice under one React key. */
export function resolveSectionOrder(present: SectionType[], config: SectionConfigEntry[] | null): SectionConfigEntry[] {
  if (config === null) return present.map((type) => ({ type, visible: true }));

  const presentSet = new Set(present);
  const seen = new Set<SectionType>();
  const configured = config.filter((entry) => {
    if (!presentSet.has(entry.type) || seen.has(entry.type)) return false;
    seen.add(entry.type);
    return true;
  });
  const appended = present.filter((type) => !seen.has(type)).map((type) => ({ type, visible: true }));
  return [...configured, ...appended];
}

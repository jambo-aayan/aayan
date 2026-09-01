import type { ReactNode } from "react";

/** The six section types a Pillar/Area page can show (#157/ADR-0016).
 * #157 renders every Pillar/Area page from an internal list of these (see
 * the `sections` array built in each page component) even though the list
 * isn't yet user-configurable — that's #160, which extends this module
 * with the actual ordering/visibility logic over a stored config. Keeping
 * the type here now means #160 doesn't need to touch every page's render
 * code again, only add config on top of a shape that's already list-based. */
export type SectionType = "northStar" | "goals" | "habits" | "systems" | "tasks" | "thoughts";

export const SECTION_LABELS: Record<SectionType, string> = {
  northStar: "North Star",
  goals: "Goals",
  habits: "Habits",
  systems: "Systems",
  tasks: "Tasks",
  thoughts: "Thoughts",
};

export type PageSection = { type: SectionType; node: ReactNode };

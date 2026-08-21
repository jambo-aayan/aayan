import type { PaletteItem } from "./types";

/** Static "Jump to" fixtures — every real page in the shell, not just the
 * 6 items in the sidebar nav (see nav-config.tsx). No colored dot per the
 * design_handoff_aayan README's Command palette spec. */
export const PALETTE_PAGES: PaletteItem[] = [
  { id: "page-home", type: "page", label: "Home", hint: null, href: "/today", color: null },
  { id: "page-insights", type: "page", label: "Insights", hint: null, href: "/insights", color: null },
  { id: "page-health", type: "page", label: "Health", hint: null, href: "/health", color: null },
  { id: "page-finances", type: "page", label: "Finances", hint: null, href: "/finances", color: null },
  { id: "page-nudges", type: "page", label: "Nudges", hint: null, href: "/nudges", color: null },
  { id: "page-settings", type: "page", label: "Settings", hint: null, href: "/settings", color: null },
  { id: "page-tasks", type: "page", label: "Tasks", hint: null, href: "/tasks", color: null },
  { id: "page-all-tasks", type: "page", label: "All Tasks", hint: null, href: "/all-tasks", color: null },
  { id: "page-by-date", type: "page", label: "By date", hint: null, href: "/by-date", color: null },
  { id: "page-habits", type: "page", label: "Habits", hint: null, href: "/habits", color: null },
  { id: "page-goals", type: "page", label: "Goals", hint: null, href: "/goals", color: null },
  { id: "page-pillars", type: "page", label: "Pillars", hint: null, href: "/pillars", color: null },
  { id: "page-thoughts", type: "page", label: "Thoughts", hint: null, href: "/thoughts", color: null },
  { id: "page-weekly-review", type: "page", label: "Weekly review", hint: null, href: "/weekly-review", color: null },
];

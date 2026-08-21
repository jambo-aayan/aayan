import type { PaletteItem, PaletteGroup, PaletteItemType } from "./types";

const MAX_PER_GROUP = 5;

/** Fixed group order per the design_handoff_aayan README's Command palette
 * spec: Jump to (pages), then Tasks, Habits, Goals, Thoughts. */
const GROUP_ORDER: { type: PaletteItemType; title: string }[] = [
  { type: "page", title: "Jump to" },
  { type: "task", title: "Tasks" },
  { type: "habit", title: "Habits" },
  { type: "goal", title: "Goals" },
  { type: "thought", title: "Thoughts" },
];

/**
 * Case-insensitive substring match over each item's label and hint — the
 * app's entire search surface, no separate index or service. Pure and
 * synchronous so it can run on every keystroke and be unit-tested directly
 * against a fixture item list.
 */
export function searchPalette(query: string, items: PaletteItem[]): PaletteGroup[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const matched = items.filter(
    (item) => item.label.toLowerCase().includes(q) || (item.hint?.toLowerCase().includes(q) ?? false)
  );

  return GROUP_ORDER.map(({ type, title }) => ({
    type,
    title,
    items: matched.filter((item) => item.type === type).slice(0, MAX_PER_GROUP),
  })).filter((group) => group.items.length > 0);
}

/** The row Enter should act on: the first item of the first non-empty
 * group, i.e. the top page hit if any page matched, else the top result
 * from the next populated group. */
export function topHit(groups: PaletteGroup[]): PaletteItem | null {
  for (const group of groups) {
    if (group.items.length > 0) return group.items[0];
  }
  return null;
}

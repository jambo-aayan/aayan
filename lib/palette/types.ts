export type PaletteItemType = "page" | "task" | "habit" | "goal" | "thought";

export type PaletteItem = {
  id: string;
  type: PaletteItemType;
  label: string;
  hint: string | null;
  href: string;
  /** Resolved hex for the row's dot — square for tasks, circle otherwise
   * (see design_handoff_aayan's Command palette spec). Null for pages,
   * which don't carry a Pillar color. */
  color: string | null;
};

export type PaletteGroup = {
  type: PaletteItemType;
  title: string;
  items: PaletteItem[];
};

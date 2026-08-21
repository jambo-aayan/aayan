export type ColorKey = "green" | "coral" | "lavender" | "gold" | "slate" | "plum";

/** The six Pillar/List accent colors from the Claude Design v2 handoff —
 * shown in every color-swatch picker going forward. Not a free color
 * picker, per the design brief. */
export const COLOR_PALETTE: { key: ColorKey; label: string; hex: string }[] = [
  { key: "green", label: "Green", hex: "#6F8F6A" },
  { key: "coral", label: "Coral", hex: "#C97B5F" },
  { key: "lavender", label: "Lavender", hex: "#8E85B0" },
  { key: "gold", label: "Gold", hex: "#B08A3E" },
  { key: "slate", label: "Slate", hex: "#6C7C88" },
  { key: "plum", label: "Plum", hex: "#96667A" },
];

/** Pre-redesign color keys that may already be stored on real Pillar/List
 * rows (the color picker shipped before this palette was reduced to the
 * handoff's six). Resolved to their original hex so anything already
 * chosen keeps rendering exactly as before — never remapped out from under
 * the user — but no longer offered in the picker UI going forward. */
const LEGACY_KEY_HEX: Record<string, string> = {
  amber: "#C79A3D",
  health: "#6E8B74",
  rose: "#B8637A",
  teal: "#4F8F86",
  ochre: "#A6752E",
};

const PALETTE_MAP = new Map(COLOR_PALETTE.map((c) => [c.key, c.hex]));

/** Resolves a stored color key to its hex. Null for an unset/unrecognized
 * key — callers fall back to Aayan's normal neutral styling, never a
 * missing-color error. */
export function resolveColorHex(key: string | null | undefined): string | null {
  if (!key) return null;
  return PALETTE_MAP.get(key as ColorKey) ?? LEGACY_KEY_HEX[key] ?? null;
}

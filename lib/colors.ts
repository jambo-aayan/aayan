export type ColorKey = "coral" | "amber" | "health" | "slate" | "lavender" | "rose" | "teal" | "ochre";

/** A tasteful, fixed palette for user-chosen Pillar/List colors — not a
 * free color picker, per the design brief. Each hex is picked to sit
 * comfortably in Aayan's warm neutral palette at low opacity (rows use it
 * as a soft tint + small accent, never a strong fill — see components that
 * consume this). */
export const COLOR_PALETTE: { key: ColorKey; label: string; hex: string }[] = [
  { key: "coral", label: "Coral", hex: "#D9714B" },
  { key: "amber", label: "Amber", hex: "#C79A3D" },
  { key: "health", label: "Green", hex: "#6E8B74" },
  { key: "slate", label: "Slate", hex: "#6C7A8C" },
  { key: "lavender", label: "Lavender", hex: "#8A7FB0" },
  { key: "rose", label: "Rose", hex: "#B8637A" },
  { key: "teal", label: "Teal", hex: "#4F8F86" },
  { key: "ochre", label: "Ochre", hex: "#A6752E" },
];

const PALETTE_MAP = new Map(COLOR_PALETTE.map((c) => [c.key, c.hex]));

/** Resolves a stored color key to its hex. Null for an unset/unrecognized
 * key — callers fall back to Aayan's normal neutral styling, never a
 * missing-color error. */
export function resolveColorHex(key: string | null | undefined): string | null {
  if (!key) return null;
  return PALETTE_MAP.get(key as ColorKey) ?? null;
}

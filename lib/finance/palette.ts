/**
 * SVG stroke/fill attributes can't read CSS custom properties, so chart
 * components need raw hex. These must stay in sync with the --coral/--amber/
 * --slate/--health tokens defined in app/globals.css.
 */
export const CHART_COLORS = {
  coral: "#C97B5F",
  amber: "#B08A3E",
  slate: "#6C7C88",
  health: "#6F8F6A",
  lavender: "#8E85B0",
  plum: "#96667A",
} as const;

export const BREAKDOWN_SEGMENT_COLORS = [
  CHART_COLORS.coral,
  CHART_COLORS.amber,
  CHART_COLORS.slate,
  CHART_COLORS.health,
  CHART_COLORS.lavender,
  CHART_COLORS.plum,
];

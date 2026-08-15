/**
 * SVG stroke/fill attributes can't read CSS custom properties, so chart
 * components need raw hex. These must stay in sync with the --coral/--amber/
 * --slate/--health tokens defined in app/globals.css.
 */
export const CHART_COLORS = {
  coral: "#D9714B",
  amber: "#C79A3D",
  slate: "#6C7A8C",
  health: "#6E8B74",
} as const;

export const BREAKDOWN_SEGMENT_COLORS = [
  CHART_COLORS.coral,
  CHART_COLORS.amber,
  CHART_COLORS.slate,
  CHART_COLORS.health,
  "#8A6FB8",
  "#4A90A4",
];

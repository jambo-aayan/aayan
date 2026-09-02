/** One shaded cell in any heatmap-style grid (#171, ADR-0017) — the
 * shared rendering primitive behind both StreakHeatmapVisual's own grid
 * and Insights' habit consistency grid, so "a titled span with a
 * background/opacity" exists in exactly one place instead of two
 * near-identical hand-rolled JSX blocks. Every visual property (layout
 * class, color, opacity) is still supplied by the caller — this changes
 * no pixels anywhere, it only removes the duplicated markup pattern.
 * Works as a flex item regardless of caller (both existing grids are
 * `display: flex` containers, where a flex child's box layout doesn't
 * depend on its tag). */
export function HeatmapCell({
  className,
  background,
  opacity,
  title,
}: {
  className: string;
  background: string;
  opacity: number;
  title: string;
}) {
  return <span className={className} style={{ background, opacity }} title={title} />;
}
